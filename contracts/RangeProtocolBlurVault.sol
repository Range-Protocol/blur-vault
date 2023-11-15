// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {NoncesUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";

import {IBlurPool} from "./blur/contracts/pool/interfaces/IBlurPool.sol";
import {IBlend} from "./blur/contracts/blend/interfaces/IBlend.sol";
import {Helpers} from "./blur/contracts/blend/Helpers.sol";
import {Lien, LienPointer} from "./blur/contracts/blend/lib/Structs.sol";

import {OwnableUpgradeable} from "./access/OwnableUpgradeable.sol";
import {RangeProtocolBlurVaultStorage} from "./RangeProtocolBlurVaultStorage.sol";
import {VaultErrors} from "./errors/VaultErrors.sol";
import {FullMath} from "./libraries/FullMath.sol";
import {DataTypes} from "./libraries/DataTypes.sol";


contract RangeProtocolBlurVault is
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    ERC20Upgradeable,
    PausableUpgradeable,
    EIP712Upgradeable,
    NoncesUpgradeable,
    IERC721Receiver,
    RangeProtocolBlurVaultStorage
{
    bytes32 private constant LIQUIDATE_ORDER_TYPEHASH =
        keccak256(
            "LiquidateOrder(address collection,uint256 tokenId,uint256 amount,address recipient,uint256 nonce,uint256 deadline)"
        );

    modifier validateLien(Lien calldata lien, uint256 lienId) {
        if (
            hashLien(state.liens[state.lienIdToIndex[lienId]].lien) !=
            hashLien(lien)
        ) revert VaultErrors.InvalidLien(lien, lienId);
        _;
    }

    receive() external payable {
        require(msg.sender == address(state.blurPool));
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyManager {}

    function initialize(bytes memory data) external override initializer {
        (
            address _manager,
            address _blurPool,
            address _blend,
            string memory _name,
            string memory _symbol
        ) = abi.decode(data, (address, address, address, string, string));
        if (_manager == address(0x0)) {
            revert VaultErrors.ZeroManagerAddress();
        }
        if (_blurPool == address(0x0)) {
            revert VaultErrors.ZeroBlurPoolAddress();
        }
        if (_blend == address(0x0)) {
            revert VaultErrors.ZeroBlendAddress();
        }

        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Ownable_init();
        __ERC20_init(_name, _symbol);
        __Pausable_init();
        __EIP712_init("https://app.rangeprotocol.com", "1");
        __Nonces_init();
        _transferOwnership(_manager);

        state.blurPool = IBlurPool(_blurPool);
        state.blend = IBlend(_blend);
    }

    function mint(
        uint256 amount
    ) external payable nonReentrant returns (uint256 shares) {
        if (amount == 0 || amount > msg.value) {
            revert VaultErrors.InvalidETHAmount(amount);
        }

        shares = totalSupply() != 0
            ? FullMath.mulDivRoundingUp(
                amount,
                totalSupply(),
                getUnderlyingBalance()
            )
            : amount;

        _mint(msg.sender, shares);
        state.blurPool.deposit{value: amount}();

        if (amount > msg.value) {
            Address.sendValue(payable(msg.sender), amount - msg.value);
        }

        emit Minted(msg.sender, shares, amount);
    }

    function burn(uint256 shares) external nonReentrant {
        if (shares == 0) {
            revert VaultErrors.ZeroBurnAmount();
        }
        if (balanceOf(msg.sender) < shares) {
            revert VaultErrors.InsufficientUserBalance();
        }

        uint256 withdrawAmount = (getUnderlyingBalance() * shares) /
            totalSupply();
        IBlurPool _blurPool = state.blurPool;
        if (_blurPool.balanceOf(address(this)) < withdrawAmount) {
            revert VaultErrors.InsufficientVaultBalance();
        }

        state.blurPool.withdraw(withdrawAmount);
        Address.sendValue(payable(msg.sender), withdrawAmount);

        emit Burned(msg.sender, shares, withdrawAmount);
    }

    function refinanceAuction(
        Lien calldata lien,
        uint256 lienId,
        uint256 rate
    ) external onlyManager {
        IBlurPool _blurPool = state.blurPool;
        uint256 debt = Helpers.computeCurrentDebt(
            lien.amount,
            lien.rate,
            lien.startTime
        );
        if (debt > _blurPool.balanceOf(address(this))) {
            revert VaultErrors.InsufficientVaultBalance();
        }

        DataTypes.LienData memory newLienData = DataTypes.LienData({
            lienId: lienId,
            lien: Lien({
                lender: address(this),
                borrower: lien.borrower,
                collection: lien.collection,
                tokenId: lien.tokenId,
                amount: debt,
                startTime: block.timestamp,
                rate: rate,
                auctionStartBlock: 0,
                auctionDuration: lien.auctionDuration
            })
        });
        state.liens.push(newLienData);
        state.lienIdToIndex[lienId] = state.liens.length - 1;
        uint256 blurBalanceBefore = _blurPool.balanceOf(address(this));
        state.blend.refinanceAuction(lien, lienId, rate);
        if (blurBalanceBefore > _blurPool.balanceOf(address(this)) + debt) {
            revert VaultErrors.ImbalancedVaultAsset();
        }

        if (state.blend.liens(lienId) != hashLien(newLienData.lien)) {
            revert VaultErrors.RefinanceFailed();
        }
        emit Loaned(lienId, debt);
    }

    event AuctionStarted(Lien lien, uint256 lienId);

    function startAuction(
        Lien calldata lien,
        uint256 lienId
    ) external onlyManager validateLien(lien, lienId) {
        state.liens[state.lienIdToIndex[lienId]].lien.auctionStartBlock = block
            .number;
        state.blend.startAuction(lien, lienId);

        emit AuctionStarted(lien, lienId);
    }

    event NFTSeized(address collection, uint256 tokenId);

    function seize(LienPointer[] calldata lienPointers) external onlyManager {
        state.blend.seize(lienPointers);
        //        for (uint256 i = 0; i < lienPointers.length; i++) emit NFTSeized();
    }

    function cleanUpLiensArray() external {
        IBlend _blend = state.blend;
        uint256 length = state.liens.length;
        for (uint256 i = 0; i < length; ) {
            DataTypes.LienData memory lienData = state.liens[i];
            if (_blend.liens(lienData.lienId) != hashLien(lienData.lien)) {
                state.liens[i] = state.liens[length - 1];
                state.liens.pop();

                if (i != length - 1) {
                    state.lienIdToIndex[state.liens[i].lienId] = i;
                }
                length--;
                continue;
            }
            unchecked {
                i++;
            }
        }
    }

    function liquidateNFT(
        address collection,
        uint256 tokenId,
        uint256 amount,
        address recipient,
        uint256 deadline,
        bytes calldata signature
    ) external payable {
        if (amount == 0 || amount > msg.value) {
            revert VaultErrors.InvalidETHAmount(amount);
        }
        if (recipient == address(0x0)) {
            revert VaultErrors.InvalidRecipient(recipient);
        }
        if (block.timestamp > deadline) {
            revert VaultErrors.OutdatedOrder(deadline);
        }

        bytes32 hash = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    LIQUIDATE_ORDER_TYPEHASH,
                    collection,
                    tokenId,
                    amount,
                    recipient,
                    _useNonce(msg.sender),
                    deadline
                )
            )
        );

        if (ECDSA.recover(hash, signature) != manager()) {
            revert VaultErrors.InvalidSignature(signature);
        }
        IERC721(collection).transferFrom(address(this), recipient, tokenId);
        state.blurPool.deposit{value: amount}();

        if (amount > msg.value) {
            Address.sendValue(payable(msg.sender), amount - msg.value);
        }

        emit NFTLiquidated(collection, tokenId, amount, recipient);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function getUnderlyingBalance() public view returns (uint256) {
        return
            state.blurPool.balanceOf(address(this)) + getCurrentlyOwnedDebt();
    }

    function getCurrentlyOwnedDebt() public view returns (uint256 ownedDebt) {
        IBlend _blend = state.blend;
        uint256 length = state.liens.length;
        for (uint256 i = 0; i < length; i++) {
            DataTypes.LienData memory lienData = state.liens[i];
            if (_blend.liens(lienData.lienId) == hashLien(lienData.lien)) {
                ownedDebt += Helpers.computeCurrentDebt(
                    lienData.lien.amount,
                    lienData.lien.rate,
                    lienData.lien.startTime
                );
            }
        }
    }

    function hashLien(Lien memory lien) private pure returns (bytes32) {
        return keccak256(abi.encode(lien));
    }
}

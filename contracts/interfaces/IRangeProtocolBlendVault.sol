// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

import {IRangeProtocolBlendVaultGetters} from "./IRangeProtocolBlendVaultGetters.sol";
import {Lien, LienPointer} from "../blur/contracts/blend/lib/Structs.sol";

interface IRangeProtocolBlendVault is IRangeProtocolBlendVaultGetters {
    struct LiquidateNFT {
        address recipient;
        uint256 amount;
        address collection;
        uint256 tokenId;
        uint256 deadline;
    }

    event Minted(address indexed to, uint256 shares, uint256 depositAmount);
    event Burned(address indexed from, uint256 shares, uint256 withdrawAmount);
    event Loaned(uint256 lienId, uint256 amount);
    event NFTLiquidated(
        address indexed collection,
        uint256 tokenId,
        uint256 amount,
        address recipient
    );
    event AuctionStarted(address collection, uint256 tokenId, uint256 lienId);
    event NFTSeized(address collection, uint256 tokenId, uint256 lienId);
    event ManagerFeeSet(uint256 managerFee);

    function initialize(bytes memory data) external;
    function mint(uint256 amount) external payable returns (uint256 shares);
    function burn(uint256 shares) external returns (uint256 withdrawAmount);
    function refinanceAuction(
        Lien calldata lien,
        uint256 lienId,
        uint256 rate
    ) external;
    function startAuction(Lien calldata lien, uint256 lienId) external;
    function seize(LienPointer[] calldata lienPointers) external;
    function cleanUpLiensArray() external;
    function liquidateNFT(
        uint256 lienId,
        address collection,
        uint256 tokenId,
        uint256 amount,
        address recipient,
        uint256 deadline,
        bytes calldata signature
    ) external payable;
    function setManagerFee(uint256 managerFee) external;
    function getUnderlyingBalance() external view returns (uint256);
    function getCurrentlyOwnedDebt() external view returns (uint256 ownedDebt);
    function collectManagerFee() external;
}

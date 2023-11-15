// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {IRangeProtocolBlurVaultGetters} from "./IRangeProtocolBlurVaultGetters.sol";

interface IRangeProtocolBlurVault is IRangeProtocolBlurVaultGetters {
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

    function initialize(bytes memory data) external;
}

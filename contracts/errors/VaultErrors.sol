// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

import {Lien} from "../blur/contracts/blend/lib/Structs.sol";

library VaultErrors {
    error ZeroManagerAddress();
    error ZeroBlurPoolAddress();
    error ZeroBlendAddress();
    error ZeroBurnAmount();
    error InsufficientUserBalance();
    error InsufficientVaultBalance();
    error ImbalancedVaultAsset();
    error RefinanceFailed();
    error InvalidLien(Lien lien, uint256 lienId);
    error InvalidETHAmount(uint256 amount);
    error InvalidRecipient(address recipient);
    error OutdatedOrder(uint256 deadline);
    error InvalidSignature(bytes signature);
    error InvalidManagerFee(uint256 managerFee);
}

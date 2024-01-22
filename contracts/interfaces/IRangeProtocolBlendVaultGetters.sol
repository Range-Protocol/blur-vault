// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.20;

import {Lien} from "../blur/contracts/blend/lib/Structs.sol";
import {IBlurPool} from "../blur/contracts/pool/interfaces/IBlurPool.sol";
import {IBlend} from "../blur/contracts/blend/interfaces/IBlend.sol";
import {DataTypes} from "../libraries/DataTypes.sol";

interface IRangeProtocolBlendVaultGetters {
    function blurPool() external view returns (IBlurPool);
    function blend() external view returns (IBlend);
    function getLiensByIndex(
        uint256 from,
        uint256 to
    ) external view returns (DataTypes.LienData[] memory liensData);
    function liensCount() external view returns (uint256);
    function managerFee() external view returns (uint256);
    function getRefinancingAuctionRate(
        Lien calldata lien,
        uint256 lienId
    ) external view returns (uint256 rateLimit);
    function getCurrentDebtByLien(
        Lien calldata lien,
        uint256 lienId
    ) external view returns (uint256 currentDebt);
    function lienIdToVirtualBalance(
        uint256 lienId
    ) external view returns (uint256);
    function virtualBalance() external view returns (uint256);
}

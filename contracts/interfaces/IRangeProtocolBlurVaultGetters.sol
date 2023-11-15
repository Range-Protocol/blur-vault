// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {Lien} from "../blur/contracts/blend/lib/Structs.sol";
import {IBlurPool} from "../blur/contracts/pool/interfaces/IBlurPool.sol";
import {IBlend} from "../blur/contracts/blend/interfaces/IBlend.sol";
import {DataTypes} from "../libraries/DataTypes.sol";

interface IRangeProtocolBlurVaultGetters {
    function blurPool() external view returns (IBlurPool);
    function blend() external view returns (IBlend);
    function getLiensByIndex(
        uint256 from,
        uint256 to
    ) external view returns (DataTypes.LienData[] memory liensData);
    function liensCount() external view returns (uint256);
}

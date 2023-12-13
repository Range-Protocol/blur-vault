// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {DataTypes} from "./libraries/DataTypes.sol";
import {IRangeProtocolBlendVault} from "./interfaces/IRangeProtocolBlendVault.sol";
import {Lien} from "./blur/contracts/blend/lib/Structs.sol";
import {IBlurPool} from "./blur/contracts/pool/interfaces/IBlurPool.sol";
import {IBlend} from "./blur/contracts/blend/interfaces/IBlend.sol";

abstract contract RangeProtocolBlendVaultStorage is IRangeProtocolBlendVault {
    DataTypes.State internal state;

    function blurPool() external view override returns (IBlurPool) {
        return state.blurPool;
    }

    function blend() external view override returns (IBlend) {
        return state.blend;
    }

    function getLiensByIndex(
        uint256 from,
        uint256 to
    ) external view override returns (DataTypes.LienData[] memory liensData) {
        liensData = new DataTypes.LienData[](to - from);
        for (uint256 i = from; i < to; i++) {
            liensData[i - from] = state.liens[i];
        }
    }

    function liensCount() external view override returns (uint256) {
        return state.liens.length;
    }

    function managerFee() external view override returns (uint256) {
        return state.managerFee;
    }

    function lienIdToVirtualBalance(
        uint256 lienId
    ) external view override returns (uint256) {
        return state.lienIdToVirtualBalance[lienId];
    }

    function virtualBalance() external view override returns (uint256) {
        return state.virtualBalance;
    }
}

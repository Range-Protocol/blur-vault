// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {IBlurPool} from "../blur/contracts/pool/interfaces/IBlurPool.sol";
import {IBlend} from "../blur/contracts/blend/interfaces/IBlend.sol";
import {Lien} from "../blur/contracts/blend/lib/Structs.sol";

library DataTypes {
    struct LienData {
        Lien lien;
        uint256 lienId;
    }

    struct State {
        IBlurPool blurPool;
        IBlend blend;
        LienData[] liens;
        mapping(uint256 => uint256) lienIdToIndex;
        uint256 managerFee;
        mapping(uint256 => uint256) lienIdToVirtualBalance;
        uint256 virtualBalance;
    }
}

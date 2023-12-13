// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import "../RangeProtocolBlendVault.sol";

contract MockVault is RangeProtocolBlendVault {
    function mockFunction() external pure returns (uint256) {
        return 1234;
    }
}

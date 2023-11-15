// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import "../RangeProtocolBlurVault.sol";

contract MockVault is RangeProtocolBlurVault {
    function mockFunction() external view returns (uint256) {
        return 1234;
    }
}

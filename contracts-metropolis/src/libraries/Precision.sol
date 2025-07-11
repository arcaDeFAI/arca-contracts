// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {Constants} from "./Constants.sol";

library Precision {
    /**
     * @dev Shifts value to the left by the precision bits.
     * @param value value to shift
     */
    function shiftPrecision(uint256 value) internal pure returns (uint256) {
        return value << Constants.ACC_PRECISION_BITS;
    }

    /**
     * @dev Unshifts value to the right by the precision bits.
     * @param value value to unshift
     */
    function unshiftPrecision(uint256 value) internal pure returns (uint256) {
        return value >> Constants.ACC_PRECISION_BITS;
    }
}

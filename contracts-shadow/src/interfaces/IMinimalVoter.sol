// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

/**
 * @title Minimal Voter Interface
 * @notice Clean-room implementation of only the functions we need from the voter
 * @dev This is a minimal interface to avoid BUSL-1.1 license issues
 */
interface IMinimalVoter {
    /**
     * @notice Returns the gauge address for a given pool
     * @param pool The pool address
     * @return The gauge address (or address(0) if not found)
     */
    function gaugeForPool(address pool) external view returns (address);
}

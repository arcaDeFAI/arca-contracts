// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

/**
 * @title Minimal Gauge Interface
 * @notice Clean-room implementation of only the functions we need from the gauge
 * @dev This is a minimal interface to avoid BUSL-1.1 license issues
 */
interface IMinimalGauge {
    /**
     * @notice Returns the reward token address
     * @return The reward token address
     */
    function rewardToken() external view returns (address);
}
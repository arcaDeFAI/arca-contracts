// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

/**
 * @title Minimal Gauge Interface
 * @notice Clean-room implementation of only the functions we need from the gauge
 * @dev This is a minimal interface to avoid BUSL-1.1 license issues
 */
interface IMinimalGauge {
    /**
     * @notice Returns the reward token address (for backward compatibility)
     * @return The reward token address
     */
    function rewardToken() external view returns (address);

    /**
     * @notice Returns array of reward token addresses
     * @return Array of reward token addresses
     */
    function rewardsList() external view returns (address[] memory);

    /**
     * @notice Returns earned amount for a specific token and account
     * @param token The reward token address
     * @param account The account to check earnings for
     * @return The earned amount
     */
    function earned(
        address token,
        address account
    ) external view returns (uint256);

    /**
     * @notice Claims rewards for specific tokens
     * @param account The account to claim rewards for
     * @param tokens Array of reward token addresses to claim
     */
    function getReward(address account, address[] calldata tokens) external;

    /**
     * @notice Claims rewards and exits (converts xSHADOW if applicable)
     * @param account The account to claim rewards for
     * @param tokens Array of reward token addresses to claim
     */
    function getRewardAndExit(
        address account,
        address[] calldata tokens
    ) external;

    /**
     * @notice Returns reward data for a specific token
     * @param token The reward token address
     * @return rewardRate The reward rate
     * @return periodFinish When the reward period ends
     * @return lastUpdateTime Last time reward was updated
     * @return rewardPerTokenStored Stored reward per token
     */
    function rewardData(
        address token
    )
        external
        view
        returns (
            uint256 rewardRate,
            uint256 periodFinish,
            uint256 lastUpdateTime,
            uint256 rewardPerTokenStored
        );
}

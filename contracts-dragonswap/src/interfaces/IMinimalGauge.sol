// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

/**
 * @title Minimal Gauge Interface
 * @notice Clean-room implementation of only the functions we need from the gauge (V3)
 * @dev This is a minimal interface to avoid BUSL-1.1 license issues
 */
interface IMinimalGauge {
    /// @notice Returns an array of reward token addresses.
    /// @return An array of reward token addresses.
    function getRewardTokens() external view returns (address[] memory);

    /// @notice Returns the amount of rewards earned for an NFP.
    /// @param token The address of the token for which to retrieve the earned rewards.
    /// @param tokenId The identifier of the specific NFP for which to retrieve the earned rewards.
    /// @return reward The amount of rewards earned for the specified NFP and tokens.
    function earned(
        address token,
        uint256 tokenId
    ) external view returns (uint256 reward);

    /// @notice retrieves rewards based on an NFP id and an array of tokens
    function getReward(uint256 tokenId, address[] memory tokens) external;

    /// @notice retrieves rewards based on an array of NFP ids and an array of tokens
    function getReward(
        uint256[] calldata tokenIds,
        address[] memory tokens
    ) external;

    /// @notice get reward for an owner of an NFP
    function getRewardForOwner(
        uint256 tokenId,
        address[] memory tokens
    ) external;

    /// @notice get xDragonswap reward for an owner of an NFP
    function getXDragonswapRewardForOwner(uint256 tokenId) external;
}

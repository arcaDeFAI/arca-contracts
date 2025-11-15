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

    /// @notice claim concentrated liquidity gauge rewards for specific NFP token ids
    /// @param _gauges array of gauges
    /// @param _tokens two dimensional array for the tokens to claim
    /// @param _nfpTokenIds two dimensional array for the NFPs
    function claimClGaugeRewards(
        address[] calldata _gauges,
        address[][] calldata _tokens,
        uint256[][] calldata _nfpTokenIds
    ) external;

    /// @notice claim arbitrary rewards from specific feeDists
    /// @param owner address of the owner
    /// @param _feeDistributors address of the feeDists
    /// @param _tokens two dimensional array for the tokens to claim
    function claimIncentives(
        address owner,
        address[] calldata _feeDistributors,
        address[][] calldata _tokens
    ) external;

    /// @notice claim arbitrary rewards from specific feeDists and break up legacy pairs
    /// @param owner address of the owner
    /// @param _feeDistributors address of the feeDists
    /// @param _tokens two dimensional array for the tokens to claim
    function claimLegacyIncentives(
        address owner,
        address[] calldata _feeDistributors,
        address[][] calldata _tokens
    ) external;

    /// @notice claim arbitrary rewards from specific gauges
    /// @param _gauges address of the gauges
    /// @param _tokens two dimensional array for the tokens to claim
    function claimRewards(
        address[] calldata _gauges,
        address[][] calldata _tokens
    ) external;

    /// @notice claim arbitrary rewards from specific legacy gauges, and exit to shadow
    /// @param _gauges address of the gauges
    /// @param _tokens two dimensional array for the tokens to claim
    function claimLegacyRewardsAndExit(
        address[] calldata _gauges,
        address[][] calldata _tokens
    ) external;

    /// @notice claim arbitrary rewards from specific cl gauges, and exit to shadow
    /// @param _gauges address of the gauges
    /// @param _tokens two dimensional array for the tokens to claim
    /// @param _nfpTokenIds two dimensional array for the nfp to claim
    function claimClGaugeRewardsAndExit(
        address[] memory _gauges,
        address[][] memory _tokens,
        uint256[][] memory _nfpTokenIds
    ) external;
}

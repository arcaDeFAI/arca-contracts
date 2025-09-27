// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IGaugeV3 {
    /// @notice Emitted when the NFP Manager is changed
    /// @param newNfpManager The address of the new NFP Manager
    /// @param oldNfpManager The address of the old NFP Manager
    event NfpManagerChanged(address indexed newNfpManager, address indexed oldNfpManager);

    /// @notice Emitted when a reward notification is made.
    /// @param from The address from which the reward is notified.
    /// @param reward The address of the reward token.
    /// @param amount The amount of rewards notified.
    /// @param period The period for which the rewards are notified.
    event NotifyReward(address indexed from, address indexed reward, uint256 amount, uint256 period);

    /// @notice Emitted when a bribe is made.
    /// @param from The address from which the bribe is made.
    /// @param reward The address of the reward token.
    /// @param amount The amount of tokens bribed.
    /// @param period The period for which the bribe is made.
    event Bribe(address indexed from, address indexed reward, uint256 amount, uint256 period);

    /// @notice Emitted when rewards are claimed.
    /// @param period The period for which the rewards are claimed.
    /// @param _positionHash The identifier of the NFP for which rewards are claimed.
    /// @param receiver The address of the receiver of the claimed rewards.
    /// @param reward The address of the reward token.
    /// @param amount The amount of rewards claimed.
    event ClaimRewards(uint256 period, bytes32 _positionHash, address receiver, address reward, uint256 amount);

    /// @notice Emitted when a new reward token was pushed to the rewards array
    event RewardAdded(address reward);

    /// @notice Emitted when a reward token was removed from the rewards array
    event RewardRemoved(address reward);

    /// @notice Returns the NFP Manager
    function nfpManager() external view returns (address);

    /// @notice updates pool data after period flip
    function updatePool() external;

    /// @notice Syncs NFP Manager from the voter
    function syncNfpManager() external;

    /// @notice returns an array of all nfpManagers in this gauge
    function getNfpManagers() external view returns (address[] memory);

    /// @notice returns the pool of this gauge
    function pool() external view returns (address);

    /// @notice Retrieves the value of the firstPeriod variable.
    /// @return The value of the firstPeriod variable.
    function firstPeriod() external returns (uint256);

    /// @notice Retrieves the total supply of a specific token for a given period.
    /// @param period The period for which to retrieve the total supply.
    /// @param token The address of the token for which to retrieve the total supply.
    /// @return The total supply of the specified token for the given period.
    function tokenTotalSupplyByPeriod(uint256 period, address token) external view returns (uint256);

    /// @notice Retrieves the getTokenTotalSupplyByPeriod of the current period.
    /// @dev included to support voter's left() check during distribute().
    /// @param token The address of the token for which to retrieve the remaining amount.
    /// @return The amount of tokens left to distribute in this period.
    function left(address token) external view returns (uint256);

    /// @notice Retrieves the reward rate for a specific reward address.
    /// @dev this method returns the base rate without boost
    /// @param token The address of the reward for which to retrieve the reward rate.
    /// @return The reward rate for the specified reward address.
    function rewardRate(address token) external view returns (uint256);

    /// @notice Retrieves the claimed amount for a specific period, position hash, and user address.
    /// @param period The period for which to retrieve the claimed amount.
    /// @param _positionHash The identifier of the NFP for which to retrieve the claimed amount.
    /// @param reward The address of the token for the claimed amount.
    /// @return The claimed amount for the specified period, token ID, and user address.
    function periodClaimedAmount(uint256 period, bytes32 _positionHash, address reward)
        external
        view
        returns (uint256);

    /// @notice Retrieves the last claimed period for a specific token, token ID combination.
    /// @param token The address of the reward token for which to retrieve the last claimed period.
    /// @param _positionHash The identifier of the NFP for which to retrieve the last claimed period.
    /// @return The last claimed period for the specified token and token ID.
    function lastClaimByToken(address token, bytes32 _positionHash) external view returns (uint256);

    /// @notice Checks if a given address is a valid reward.
    /// @param reward The address to check.
    /// @return A boolean indicating whether the address is a valid reward.
    function isGaugeReward(address reward) external view returns (bool);

    /// @notice Returns an array of reward token addresses.
    /// @return An array of reward token addresses.
    function getRewardTokens() external view returns (address[] memory);

    /// @notice Returns the hash used to store positions in a mapping
    /// @param owner The address of the position owner
    /// @param index The index of the position
    /// @param tickLower The lower tick boundary of the position
    /// @param tickUpper The upper tick boundary of the position
    /// @return _hash The hash used to store positions in a mapping
    function positionHash(address owner, uint256 index, int24 tickLower, int24 tickUpper)
        external
        pure
        returns (bytes32);

    /// @notice how many times periodAmounts has been written
    function periodAmountsWrittenVersion(uint256 period, bytes32 positionHash) external view returns (uint256);

    /// @notice seconds an NFP was in range for the period, multiplied by 2**96 for precision
    function periodNfpSecondsX96(uint256 period, bytes32 positionHash) external view returns (uint256);

    /// @notice secondsPerLiquidity at the end of a period
    function periodEndSecondsPerLiquidityCumulativeX128(uint256 period) external view returns (uint160);

    /// @notice whether the gauge should use pool data or its own storage to determine rewards
    function usePoolData(uint256 period) external view returns (bool);

    /// @notice how many times periodEndSecondsPerLiquidityCumulativeX128 has been written
    function periodEndVersion(uint256 period) external view returns (uint256);

    /// @notice last known cardinality of the pool's oracle
    function lastCardinality() external view returns (uint256);

    /// @notice last known period of the pool
    function cachedPoolLastPeriod() external view returns (uint256);

    /*
    /// @notice Retrieves the liquidity and boosted liquidity for a specific NFP.
    /// @param tokenId The identifier of the NFP.
    /// @return liquidity The liquidity of the position token.
    function positionInfo(
        uint256 tokenId
    ) external view returns (uint128 liquidity);
    */

    /// @notice Returns the amount of rewards earned for an NFP.
    /// @param token The address of the token for which to retrieve the earned rewards.
    /// @param tokenId The identifier of the specific NFP for which to retrieve the earned rewards.
    /// @return reward The amount of rewards earned for the specified NFP and tokens.
    function earned(address token, uint256 tokenId) external view returns (uint256 reward);

    /// @notice Returns the amount of rewards earned during a period for an NFP.
    /// @param period The period for which to retrieve the earned rewards.
    /// @param token The address of the token for which to retrieve the earned rewards.
    /// @param tokenId The identifier of the specific NFP for which to retrieve the earned rewards.
    /// @return reward The amount of rewards earned for the specified NFP and tokens.
    function periodEarned(uint256 period, address token, uint256 tokenId) external view returns (uint256);

    /// @notice Retrieves the earned rewards for a specific period, token, owner, index, tickLower, and tickUpper.
    /// @param period The period for which to retrieve the earned rewards.
    /// @param token The address of the token for which to retrieve the earned rewards.
    /// @param owner The address of the owner for which to retrieve the earned rewards.
    /// @param index The index for which to retrieve the earned rewards.
    /// @param tickLower The tick lower bound for which to retrieve the earned rewards.
    /// @param tickUpper The tick upper bound for which to retrieve the earned rewards.
    /// @return The earned rewards for the specified period, token, owner, index, tickLower, and tickUpper.
    function periodEarned(uint256 period, address token, address owner, uint256 index, int24 tickLower, int24 tickUpper)
        external
        view
        returns (uint256);

    /// @notice Retrieves the earned rewards for a specific period, token, owner, index, tickLower, and tickUpper.
    /// @dev used by getReward() and saves gas by saving states
    /// @param period The period for which to retrieve the earned rewards.
    /// @param token The address of the token for which to retrieve the earned rewards.
    /// @param owner The address of the owner for which to retrieve the earned rewards.
    /// @param index The index for which to retrieve the earned rewards.
    /// @param tickLower The tick lower bound for which to retrieve the earned rewards.
    /// @param tickUpper The tick upper bound for which to retrieve the earned rewards.
    /// @param caching Whether to cache the results or not.
    /// @return The earned rewards for the specified period, token, owner, index, tickLower, and tickUpper.
    function cachePeriodEarned(
        uint256 period,
        address token,
        address owner,
        uint256 index,
        int24 tickLower,
        int24 tickUpper,
        bool caching
    ) external returns (uint256);

    /// @notice Notifies the contract about the amount of rewards to be distributed for a specific token.
    /// @param token The address of the token for which to notify the reward amount.
    /// @param amount The amount of rewards to be distributed.
    function notifyRewardAmount(address token, uint256 amount) external;

    /// @notice Retrieves the reward amount for a specific period, NFP, and token addresses.
    /// @param period The period for which to retrieve the reward amount.
    /// @param tokens The addresses of the tokens for which to retrieve the reward amount.
    /// @param tokenId The identifier of the specific NFP for which to retrieve the reward amount.
    /// @param receiver The address of the receiver of the reward amount.
    function getPeriodReward(uint256 period, address[] calldata tokens, uint256 tokenId, address receiver) external;

    /// @notice Retrieves the reward amount for a specific NFP Manager, period, NFP, and token addresses.
    /// @param __nfpManager The NFP Manager.
    /// @param period The period for which to retrieve the reward amount.
    /// @param tokens The addresses of the tokens for which to retrieve the reward amount.
    /// @param tokenId The identifier of the specific NFP for which to retrieve the reward amount.
    /// @param receiver The address of the receiver of the reward amount.
    function getNfpPeriodReward(
        address __nfpManager,
        uint256 period,
        address[] calldata tokens,
        uint256 tokenId,
        address receiver
    ) external;

    /// @notice Retrieves the rewards for a specific period, set of tokens, owner, index, tickLower, tickUpper, and receiver.
    /// @param period The period for which to retrieve the rewards.
    /// @param tokens An array of token addresses for which to retrieve the rewards.
    /// @param owner The address of the owner for which to retrieve the rewards.
    /// @param index The index for which to retrieve the rewards.
    /// @param tickLower The tick lower bound for which to retrieve the rewards.
    /// @param tickUpper The tick upper bound for which to retrieve the rewards.
    /// @param receiver The address of the receiver of the rewards.
    function getPeriodReward(
        uint256 period,
        address[] calldata tokens,
        address owner,
        uint256 index,
        int24 tickLower,
        int24 tickUpper,
        address receiver
    ) external;

    /// @notice retrieves rewards based on an NFP id and an array of tokens
    function getReward(uint256 tokenId, address[] memory tokens) external;
    /// @notice retrieves rewards based on an array of NFP ids and an array of tokens
    function getReward(uint256[] calldata tokenIds, address[] memory tokens) external;
    /// @notice get reward for an owner of an NFP
    function getRewardForOwner(uint256 tokenId, address[] memory tokens) external;
    /// @notice get xShadow reward for an owner of an NFP
    function getXShadowRewardForOwner(uint256 tokenId) external;

    /// @notice Notifies rewards for periods greater than current period
    /// @dev does not push fees
    /// @dev requires reward token to be whitelisted
    function notifyRewardAmountForPeriod(address token, uint256 amount, uint256 period) external;

    /// @notice Notifies rewards for next period
    /// @dev does not push fees
    /// @dev requires reward token to be whitelisted
    function notifyRewardAmountNextPeriod(address token, uint256 amount) external;

    /// @notice for when distribute is called too late and the team needs to update period data
    function updatePeriodData(uint256 period, uint160 periodEndSecondsPerLiquidityCumulativeX128) external;
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBribeRewardsHarvester
 * @dev Interface for the Complete Bribe Rewards System harvesting functionality
 * 
 * Visual Analogy: Think of this as a "Dividend Bank Account Manager" 🏦💰
 * - Each harvest creates a new "dividend epoch"
 * - User's share = (their total stake / total stakes) × total rewards per token
 * - Unclaimed rewards from previous epochs accumulate
 * - Users can claim ALL accumulated rewards from multiple epochs at once
 * - No time limits - rewards never expire
 */
interface IstakingManager {
    
    // =================
    // EVENTS
    // =================
    
    /**
     * @dev Emitted when a new epoch is created with user stakes snapshot
     * @param epochId The unique identifier for this dividend period
     * @param totalUsers Number of users participating in this epoch
     * @param totalStaked Total amount staked across all users
     */
    event EpochCreated(uint256 indexed epochId, uint256 totalUsers, uint256 totalStaked);
    
    /**
     * @dev Emitted when rewards are distributed for a specific token in an epoch
     * @param epochId The epoch where rewards were distributed
     * @param token The reward token address
     * @param amount Total amount of this token distributed
     */
    event EpochRewardsDistributed(uint256 indexed epochId, address indexed token, uint256 amount);
    
    /**
     * @dev Emitted when bribe rewards are harvested from external sources
     * @param epochId The epoch where harvesting occurred
     * @param period The voting period from which rewards were claimed
     * @param totalRewarders Number of rewarder contracts claimed from
     */
    event BribeRewardsHarvested(uint256 indexed epochId, uint256 period, uint256 totalRewarders);
    
    /**
     * @dev Emitted when a user claims their rewards
     * @param user The user claiming rewards
     * @param epochId The epoch from which rewards were claimed
     * @param token The reward token claimed
     * @param amount Amount of tokens claimed
     */
    event RewardsClaimed(address indexed user, uint256 indexed epochId, address indexed token, uint256 amount);
    
    /**
     * @dev Emitted when a new reward token is added to supported list
     * @param token The new supported reward token address
     */
    event SupportedTokenAdded(address indexed token);
    
    // =================
    // MAIN HARVEST FUNCTION
    // =================
    
    /**
     * @dev Create new epoch with user stakes and harvest/distribute bribe rewards
     * 
     * Visual Process:
     * 1. 📸 Takes a "snapshot" of all user stakes (like quarterly account statement)
     * 2. 🌾 Harvests bribe rewards from external voter contracts
     * 3. 🧮 Calculates proportional distribution: Your share = (Your stake ÷ Total stakes) × Total rewards
     * 4. ✅ Makes rewards available for claiming
     * 
     * Formula: User's Reward = (User's Total Stake / Total All Stakes) × Total Rewards Per Token
     * 
     * Example:
     * - Alice stakes 300 tokens, Bob stakes 200, Carol stakes 500 (Total: 1000)
     * - System harvests 1000 USDC in rewards
     * - Alice gets: (300/1000) × 1000 = 300 USDC
     * - Bob gets: (200/1000) × 1000 = 200 USDC  
     * - Carol gets: (500/1000) × 1000 = 500 USDC
     * 
     * @param users Array of user addresses who have active stakes
     * @param userTokenIds Array of arrays - each user's staked token IDs
     * @param userStakeAmounts Array of arrays - each user's stake amounts per token ID
     * @param userTotalStakes Array of each user's total staked amount (must equal sum of their stake amounts)
     * 
     * Requirements:
     * - All arrays must have the same length
     * - Each user's tokenIds and stakeAmounts arrays must have the same length
     * - Each user's totalStake must equal the sum of their stakeAmounts
     * - Only contract owner can call this function
     * 
     * Effects:
     * - Increments currentEpochId
     * - Creates snapshot of user stakes for the new epoch
     * - Harvests available bribe rewards from voter contracts
     * - Distributes harvested rewards proportionally
     * - Accumulates any unclaimed rewards from previous epoch
     */
    function harvestAndDistributeBribes(
        address[] calldata users,
        uint256[][] calldata userTokenIds,
        uint256[][] calldata userStakeAmounts,
        uint256[] calldata userTotalStakes
    ) external;
    
    // =================
    // VIEW FUNCTIONS FOR MONITORING
    // =================
    
    /**
     * @dev Get user's total claimable rewards across all epochs and tokens
     * @param user The user address to query
     * @return tokens Array of reward token addresses
     * @return amounts Array of claimable amounts for each token
     */
    function getUserTotalClaimableRewards(address user) external view returns (
        address[] memory tokens,
        uint256[] memory amounts
    );
    
    /**
     * @dev Get user's rewards for a specific epoch
     * @param user The user address to query
     * @param epochId The epoch to query
     * @return tokens Array of reward token addresses in this epoch
     * @return amounts Array of reward amounts for each token
     * @return claimed Array indicating if each token reward was claimed
     */
    function getUserEpochRewards(address user, uint256 epochId) external view returns (
        address[] memory tokens,
        uint256[] memory amounts,
        bool[] memory claimed
    );
    
    /**
     * @dev Get user's stake information for a specific epoch
     * @param user The user address to query
     * @param epochId The epoch to query
     * @return totalStakedAmount User's total staked amount in this epoch
     * @return tokenIds Array of user's token IDs in this epoch
     * @return stakeAmounts Array of stake amounts per token ID
     */
    function getUserEpochStake(address user, uint256 epochId) external view returns (
        uint256 totalStakedAmount,
        uint256[] memory tokenIds,
        uint256[] memory stakeAmounts
    );
    
    /**
     * @dev Get comprehensive epoch information
     * @param epochId The epoch to query
     * @return totalStaked Total amount staked by all users in this epoch
     * @return userCount Number of users participating in this epoch
     * @return rewardTokens Array of reward token addresses in this epoch
     * @return rewardAmounts Array of total reward amounts per token
     * @return distributed Whether this epoch has been distributed
     */
    function getEpochInfo(uint256 epochId) external view returns (
        uint256 totalStaked,
        uint256 userCount,
        address[] memory rewardTokens,
        uint256[] memory rewardAmounts,
        bool distributed
    );
    
    /**
     * @dev Get current epoch ID (latest dividend period)
     * @return The current epoch identifier
     */
    function getCurrentEpochId() external view returns (uint256);
    
    /**
     * @dev Check if user has any claimable rewards
     * @param user The user address to check
     * @return true if user has rewards to claim, false otherwise
     */
    function userHasClaimableRewards(address user) external view returns (bool);
    
    /**
     * @dev Get user's ownership percentage for specific epoch
     * @param user The user address to query
     * @param epochId The epoch to query
     * @return percentage User's share scaled by 10000 (1500 = 15.00%)
     */
    function getUserEpochSharePercentage(address user, uint256 epochId) external view returns (uint256);
    
    /**
     * @dev Get all users who participated in a specific epoch
     * @param epochId The epoch to query
     * @return Array of user addresses in this epoch
     */
    function getEpochUsers(uint256 epochId) external view returns (address[] memory);
    
    // =================
    // USER CLAIM FUNCTIONS
    // =================
    
    /**
     * @dev User claims ALL their accumulated bribe rewards from all epochs
     * 
     * Visual Process: Like withdrawing all accumulated dividends from your bank account
     * 
     * This includes:
     * - Current epoch rewards (if distributed and not yet claimed)
     * - Accumulated rewards from all previous unclaimed epochs
     * 
     * Effects:
     * - Transfers all claimable tokens to user's wallet
     * - Resets user's accumulated reward balances to zero
     * - Marks all relevant epochs as claimed for this user
     * - Updates user's last claimed epoch tracker
     * 
     * Requirements:
     * - User must have claimable rewards (> 0)
     * - Protected against reentrancy attacks
     */
    function claimAllMyBribeRewards() external;
    
    // =================
    // ADMIN FUNCTIONS
    // =================
    
    /**
     * @dev Add a new supported reward token
     * @param token The reward token address to add
     */
    function addSupportedToken(address token) external;
    
    /**
     * @dev Remove a supported reward token
     * @param token The reward token address to remove
     */
    function removeSupportedToken(address token) external;
    
    /**
     * @dev Get all currently supported reward tokens
     * @return Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory);
    
    /**
     * @dev Emergency function to manually mark an epoch as distributed
     * @param epochId The epoch to mark as distributed
     */
    function emergencyDistributeEpoch(uint256 epochId) external;
}

/**
 * @title IBribeRewardsHarvesterExtended
 * @dev Extended interface with additional helper functions for integration
 */
interface IBribeRewardsHarvesterExtended is IBribeRewardsHarvester {
    
    /**
     * @dev Batch query multiple users' claimable rewards
     * @param userAddresses Array of user addresses to query
     * @return users Array of user addresses (same order as input)
     * @return tokens Array of token addresses with claimable rewards
     * @return amounts 2D array: amounts[userIndex][tokenIndex] = claimable amount
     */
    function batchGetUserClaimableRewards(address[] calldata userAddresses) external view returns (
        address[] memory users,
        address[] memory tokens,
        uint256[][] memory amounts
    );
    
    /**
     * @dev Get summary statistics for an epoch
     * @param epochId The epoch to analyze
     * @return totalRewardValue Total USD value of rewards (if oracle available)
     * @return participationRate Percentage of total possible stakers who participated
     * @return averageStakePerUser Average stake amount per user
     * @return topStakerShare Percentage owned by the largest staker
     */
    function getEpochStatistics(uint256 epochId) external view returns (
        uint256 totalRewardValue,
        uint256 participationRate,
        uint256 averageStakePerUser,
        uint256 topStakerShare
    );
    
    /**
     * @dev Preview what rewards would be distributed before actually harvesting
     * @param users Array of user addresses
     * @param userTotalStakes Array of user stake amounts
     * @return estimatedTokens Array of token addresses likely to have rewards
     * @return estimatedAmounts Array of estimated reward amounts per token
     */
    function previewHarvestRewards(
        address[] calldata users,
        uint256[] calldata userTotalStakes
    ) external view returns (
        address[] memory estimatedTokens,
        uint256[] memory estimatedAmounts
    );
}
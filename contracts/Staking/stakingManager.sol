// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin/security/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin/access/Ownable.sol";

// Interfaces
interface IVoter {
    function getLatestFinishedPeriod() external view returns (uint256);
    function getUserBribeRewarderLength(uint256 period, address account) external view returns (uint256);
    function getUserBribeRewaderAt(uint256 period, address account, uint256 index) external view returns (address);
}

interface IRewarderFactory {
    function claimBribeRewards(address[] calldata rewarders, address account) external;
}

/**
 * @title CompleteBribeRewardsSystem
 * @dev Proportional bribe rewards distribution system with accumulating epochs
 * 
 * Visual Analogy: Think of this as a "Dividend Bank Account" 🏦💰
 * - Each harvest creates a new "dividend epoch"
 * - User's share = (their total stake / total stakes) × total rewards per token
 * - Unclaimed rewards from previous epochs accumulate
 * - Users can claim ALL accumulated rewards from multiple epochs at once
 * - No time limits - rewards never expire
 */
contract CompleteBribeRewardsSystem is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // =================
    // STRUCTS
    // =================
    
    // User's stake snapshot for a specific epoch
    struct UserEpochStake {
        uint256 totalStakedAmount;  // User's total staked amount in this epoch
        uint256[] tokenIds;         // User's token IDs in this epoch
        uint256[] stakeAmounts;     // Stake amounts per token ID
    }
    
    // Epoch reward distribution data
    struct EpochRewards {
        uint256 epochId;
        uint256 totalStakedInEpoch;                    // Total staked by all users in this epoch
        mapping(address => uint256) rewardAmountPerToken; // token address => total reward amount for this token in this epoch
        address[] rewardTokens;                        // List of reward tokens in this epoch
        mapping(address => UserEpochStake) userStakes; // user address => their stake info for this epoch
        address[] users;                               // List of users in this epoch
        bool distributed;                              // Has this epoch been distributed
    }
    
    // =================
    // STATE VARIABLES
    // =================
    
    // External contracts
    IVoter public immutable voter;
    IRewarderFactory public immutable rewarderFactory;
    address public immutable stakingContract;
    
    // Epoch management
    uint256 public currentEpochId;
    mapping(uint256 => EpochRewards) public epochs; // epochId => EpochRewards
    
    // User claiming tracking
    mapping(address => mapping(uint256 => mapping(address => bool))) public userEpochTokenClaimed; 
    // user => epochId => token => claimed
    
    mapping(address => mapping(address => uint256)) public userAccumulatedRewards;
    // user => token => total accumulated unclaimed amount
    
    mapping(address => uint256) public userLastClaimedEpoch;
    // user => last epoch they claimed from (for accumulation logic)
    
    // Supported reward tokens
    mapping(address => bool) public supportedTokens;
    address[] public supportedTokensList;
    
    // =================
    // EVENTS
    // =================
    
    event EpochCreated(uint256 indexed epochId, uint256 totalUsers, uint256 totalStaked);
    event EpochRewardsDistributed(uint256 indexed epochId, address indexed token, uint256 amount);
    event BribeRewardsHarvested(uint256 indexed epochId, uint256 period, uint256 totalRewarders);
    event RewardsClaimed(address indexed user, uint256 indexed epochId, address indexed token, uint256 amount);



    constructor(
    address _voter,
    address _rewarderFactory,
    address _stakingContract,
    address initialOwner
    ) Ownable(initialOwner) {
        require(_voter != address(0), "Zero voter");
        require(_rewarderFactory != address(0), "Zero factory");
        require(_stakingContract != address(0), "Zero staking");
        
        voter = IVoter(_voter);
        rewarderFactory = IRewarderFactory(_rewarderFactory);
        stakingContract = _stakingContract;
    }



    // =================
    // VIEW FUNCTIONS FOR FRONTEND
    // =================
    
    /**
     * @dev Get user's total claimable rewards across all epochs and tokens
     */
    function getUserTotalClaimableRewards(address user) external view returns (
        address[] memory tokens,
        uint256[] memory amounts
    ) {
        tokens = new address[](supportedTokensList.length);
        amounts = new uint256[](supportedTokensList.length);
        
        for (uint256 i = 0; i < supportedTokensList.length; i++) {
            address token = supportedTokensList[i];
            uint256 totalClaimable = 0;
            
            // Add accumulated rewards from previous epochs
            totalClaimable += userAccumulatedRewards[user][token];
            
            // Add current epoch rewards (if distributed and not claimed)
            if (currentEpochId > 0 && epochs[currentEpochId].distributed) {
                if (!userEpochTokenClaimed[user][currentEpochId][token]) {
                    totalClaimable += _calculateUserEpochReward(user, currentEpochId, token);
                }
            }
            
            tokens[i] = token;
            amounts[i] = totalClaimable;
        }
        
        return (tokens, amounts);
    }
    
    /**
     * @dev Get user's rewards for a specific epoch
     */
    function getUserEpochRewards(address user, uint256 epochId) external view returns (
        address[] memory tokens,
        uint256[] memory amounts,
        bool[] memory claimed
    ) {
        EpochRewards storage epoch = epochs[epochId];
        
        tokens = new address[](epoch.rewardTokens.length);
        amounts = new uint256[](epoch.rewardTokens.length);
        claimed = new bool[](epoch.rewardTokens.length);
        
        for (uint256 i = 0; i < epoch.rewardTokens.length; i++) {
            address token = epoch.rewardTokens[i];
            tokens[i] = token;
            amounts[i] = _calculateUserEpochReward(user, epochId, token);
            claimed[i] = userEpochTokenClaimed[user][epochId][token];
        }
        
        return (tokens, amounts, claimed);
    }
    
    /**
     * @dev Get user's stake info for a specific epoch
     */
    function getUserEpochStake(address user, uint256 epochId) external view returns (
        uint256 totalStakedAmount,
        uint256[] memory tokenIds,
        uint256[] memory stakeAmounts
    ) {
        UserEpochStake storage userStake = epochs[epochId].userStakes[user];
        return (userStake.totalStakedAmount, userStake.tokenIds, userStake.stakeAmounts);
    }
    
    /**
     * @dev Get epoch summary info
     */
    function getEpochInfo(uint256 epochId) external view returns (
        uint256 totalStaked,
        uint256 userCount,
        address[] memory rewardTokens,
        uint256[] memory rewardAmounts,
        bool distributed
    ) {
        EpochRewards storage epoch = epochs[epochId];
        
        rewardAmounts = new uint256[](epoch.rewardTokens.length);
        for (uint256 i = 0; i < epoch.rewardTokens.length; i++) {
            rewardAmounts[i] = epoch.rewardAmountPerToken[epoch.rewardTokens[i]];
        }
        
        return (
            epoch.totalStakedInEpoch,
            epoch.users.length,
            epoch.rewardTokens,
            rewardAmounts,
            epoch.distributed
        );
    }
    
    /**
     * @dev Get current epoch ID
     */
    function getCurrentEpochId() external view returns (uint256) {
        return currentEpochId;
    }
    
    /**
     * @dev Check if user has any claimable rewards
     */
    function userHasClaimableRewards(address user) external view returns (bool) {
        // Check accumulated rewards
        for (uint256 i = 0; i < supportedTokensList.length; i++) {
            if (userAccumulatedRewards[user][supportedTokensList[i]] > 0) {
                return true;
            }
        }
        
        // Check current epoch rewards
        if (currentEpochId > 0 && epochs[currentEpochId].distributed) {
            for (uint256 i = 0; i < supportedTokensList.length; i++) {
                address token = supportedTokensList[i];
                if (!userEpochTokenClaimed[user][currentEpochId][token]) {
                    if (_calculateUserEpochReward(user, currentEpochId, token) > 0) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * @dev Get user's share percentage for specific epoch (scaled by 10000, so 1500 = 15.00%)
     */
    function getUserEpochSharePercentage(address user, uint256 epochId) external view returns (uint256) {
        EpochRewards storage epoch = epochs[epochId];
        if (epoch.totalStakedInEpoch == 0) return 0;
        
        UserEpochStake storage userStake = epoch.userStakes[user];
        return (userStake.totalStakedAmount * 10000) / epoch.totalStakedInEpoch;
    }
    
    // =================
    // ADMIN FUNCTIONS
    // =================
    
    /**
     * @dev Add supported reward token
     */
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Zero address");
        require(!supportedTokens[token], "Token already supported");
        
        supportedTokens[token] = true;
        supportedTokensList.push(token);
        
        emit SupportedTokenAdded(token);
    }
    
    /**
     * @dev Remove supported reward token
     */
    function removeSupportedToken(address token) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        
        supportedTokens[token] = false;
        
        // Remove from array
        for (uint256 i = 0; i < supportedTokensList.length; i++) {
            if (supportedTokensList[i] == token) {
                supportedTokensList[i] = supportedTokensList[supportedTokensList.length - 1];
                supportedTokensList.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokensList;
    }
    
    /**
     * @dev Get users in specific epoch
     */
    function getEpochUsers(uint256 epochId) external view returns (address[] memory) {
        return epochs[epochId].users;
    }
    
    /**
     * @dev Emergency function to manually distribute a specific epoch (if something went wrong)
     */
    function emergencyDistributeEpoch(uint256 epochId) external onlyOwner {
        require(epochId <= currentEpochId, "Invalid epoch");
        epochs[epochId].distributed = true;
    }
}
    
    // =================
    // MAIN HARVEST FUNCTION
    // =================
    
    /**
     * @dev Create new epoch with user stakes and harvest/distribute bribe rewards
     * Formula: User's share = (User's total stake / Total stakes) × Total rewards per token
     * 
     * @param users Array of user addresses who have active stakes
     * @param userTokenIds Array of arrays - each user's token IDs  
     * @param userStakeAmounts Array of arrays - each user's stake amounts per token ID
     * @param userTotalStakes Array of each user's total staked amount
     */
    function harvestAndDistributeBribes(
        address[] calldata users,
        uint256[][] calldata userTokenIds,
        uint256[][] calldata userStakeAmounts,
        uint256[] calldata userTotalStakes
    ) external onlyOwner {
        require(users.length == userTokenIds.length, "Length mismatch: users/tokenIds");
        require(users.length == userStakeAmounts.length, "Length mismatch: users/stakeAmounts"); 
        require(users.length == userTotalStakes.length, "Length mismatch: users/totalStakes");
        
        // Step 1: Before creating new epoch, accumulate unclaimed rewards from previous epoch
        if (currentEpochId > 0) {
            _accumulateUnclaimedRewards();
        }
        
        // Step 2: Increment epoch
        currentEpochId++;
        
        // Step 3: Create new epoch with user stakes snapshot
        _createEpochSnapshot(users, userTokenIds, userStakeAmounts, userTotalStakes);
        
        // Step 4: Harvest all bribe rewards from voter contracts
        _harvestBribeRewards();
        
        // Step 5: Check what tokens we received and distribute them proportionally
        _distributeHarvestedRewards();
        
        // Step 6: Mark epoch as distributed
        epochs[currentEpochId].distributed = true;
    }
    
    /**
     * @dev Accumulate unclaimed rewards from previous epoch for all users
     */
    function _accumulateUnclaimedRewards() internal {
        uint256 previousEpochId = currentEpochId;
        EpochRewards storage previousEpoch = epochs[previousEpochId];
        
        if (!previousEpoch.distributed) return; // No previous epoch to accumulate from
        
        // For each user in previous epoch
        for (uint256 i = 0; i < previousEpoch.users.length; i++) {
            address user = previousEpoch.users[i];
            
            // For each reward token in previous epoch
            for (uint256 j = 0; j < previousEpoch.rewardTokens.length; j++) {
                address token = previousEpoch.rewardTokens[j];
                
                // Check if user hasn't claimed this token from previous epoch
                if (!userEpochTokenClaimed[user][previousEpochId][token]) {
                    // Calculate their unclaimed amount
                    uint256 unclaimedAmount = _calculateUserEpochReward(user, previousEpochId, token);
                    
                    if (unclaimedAmount > 0) {
                        // Add to their accumulated rewards
                        userAccumulatedRewards[user][token] += unclaimedAmount;
                        
                        // Mark as accumulated (so we don't double-count)
                        userEpochTokenClaimed[user][previousEpochId][token] = true;
                    }
                }
            }
        }
    }
    
    /**
     * @dev Create snapshot of all user stakes for the new epoch
     */
    function _createEpochSnapshot(
        address[] calldata users,
        uint256[][] calldata userTokenIds,
        uint256[][] calldata userStakeAmounts,
        uint256[] calldata userTotalStakes
    ) internal {
        EpochRewards storage newEpoch = epochs[currentEpochId];
        newEpoch.epochId = currentEpochId;
        
        uint256 totalStaked = 0;
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256[] calldata tokenIds = userTokenIds[i];
            uint256[] calldata stakeAmounts = userStakeAmounts[i];
            uint256 userTotal = userTotalStakes[i];
            
            require(tokenIds.length == stakeAmounts.length, "TokenIds/amounts length mismatch");
            
            // Verify user total matches sum of individual stakes
            uint256 calculatedTotal = 0;
            for (uint256 j = 0; j < stakeAmounts.length; j++) {
                calculatedTotal += stakeAmounts[j];
            }
            require(calculatedTotal == userTotal, "User total stake mismatch");
            
            // Store user stake snapshot for this epoch
            newEpoch.userStakes[user] = UserEpochStake({
                totalStakedAmount: userTotal,
                tokenIds: tokenIds,
                stakeAmounts: stakeAmounts
            });
            
            newEpoch.users.push(user);
            totalStaked += userTotal;
        }
        
        newEpoch.totalStakedInEpoch = totalStaked;
        
        emit EpochCreated(currentEpochId, users.length, totalStaked);
    }
    
    /**
     * @dev Harvest bribe rewards from voter contracts
     */
    function _harvestBribeRewards() internal {
        // Get the latest finished period we can claim from
        uint256 claimablePeriod;
        try voter.getLatestFinishedPeriod() returns (uint256 period) {
            claimablePeriod = period;
        } catch {
            // No finished period yet, nothing to claim
            return;
        }
        
        // Get all rewarders for the staking contract
        uint256 rewarderCount = voter.getUserBribeRewarderLength(claimablePeriod, stakingContract);
        
        if (rewarderCount == 0) {
            return;
        }
        
        // Build rewarders array
        address[] memory rewarders = new address[](rewarderCount);
        for (uint256 i = 0; i < rewarderCount; i++) {
            rewarders[i] = voter.getUserBribeRewaderAt(claimablePeriod, stakingContract, i);
        }
        
        // Claim all bribe rewards to this contract
        rewarderFactory.claimBribeRewards(rewarders, stakingContract);
        
        emit BribeRewardsHarvested(currentEpochId, claimablePeriod, rewarderCount);
    }
    
    /**
     * @dev Distribute harvested rewards proportionally to epoch
     */
    function _distributeHarvestedRewards() internal {
        EpochRewards storage currentEpoch = epochs[currentEpochId];
        
        // Check balance of each supported token and add to epoch
        for (uint256 i = 0; i < supportedTokensList.length; i++) {
            address token = supportedTokensList[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            
            // Subtract any accumulated rewards that belong to users from previous epochs
            uint256 availableForDistribution = balance;
            
            if (balance > 0 && currentEpoch.totalStakedInEpoch > 0) {
                // Add this token to epoch rewards
                currentEpoch.rewardAmountPerToken[token] = availableForDistribution;
                
                // Add to reward tokens list if not already there
                bool tokenExists = false;
                for (uint256 j = 0; j < currentEpoch.rewardTokens.length; j++) {
                    if (currentEpoch.rewardTokens[j] == token) {
                        tokenExists = true;
                        break;
                    }
                }
                if (!tokenExists) {
                    currentEpoch.rewardTokens.push(token);
                }
                
                emit EpochRewardsDistributed(currentEpochId, token, availableForDistribution);
            }
        }
    }
    
    // =================
    // USER CLAIM FUNCTIONS
    // =================
    
    /**
     * @dev User claims ALL their accumulated bribe rewards from all epochs
     * This includes:
     * - Current epoch rewards (if any)
     * - Accumulated rewards from previous unclaimed epochs
     */
    function claimAllMyBribeRewards() external nonReentrant {
        address user = msg.sender;
        bool claimedAny = false;
        
        // Claim from each supported token
        for (uint256 i = 0; i < supportedTokensList.length; i++) {
            address token = supportedTokensList[i];
            uint256 totalClaimable = 0;
            
            // Add accumulated rewards from previous epochs
            totalClaimable += userAccumulatedRewards[user][token];
            
            // Add current epoch rewards (if epoch is distributed and user hasn't claimed)
            if (currentEpochId > 0 && epochs[currentEpochId].distributed) {
                if (!userEpochTokenClaimed[user][currentEpochId][token]) {
                    uint256 currentEpochReward = _calculateUserEpochReward(user, currentEpochId, token);
                    totalClaimable += currentEpochReward;
                }
            }
            
            if (totalClaimable > 0) {
                // Transfer rewards to user
                IERC20(token).safeTransfer(user, totalClaimable);
                
                // Reset accumulated rewards
                userAccumulatedRewards[user][token] = 0;
                
                // Mark current epoch as claimed
                if (currentEpochId > 0 && epochs[currentEpochId].distributed) {
                    userEpochTokenClaimed[user][currentEpochId][token] = true;
                }
                
                // Update last claimed epoch
                userLastClaimedEpoch[user] = currentEpochId;
                
                emit RewardsClaimed(user, currentEpochId, token, totalClaimable);
                claimedAny = true;
            }
        }
        
        require(claimedAny, "No rewards to claim");
    }
    
    /**
     * @dev Calculate user's reward for a specific epoch and token
     * Formula: (User's total stake in epoch / Total stakes in epoch) × Total rewards for token
     */
    function _calculateUserEpochReward(
        address user, 
        uint256 epochId, 
        address token
    ) internal view returns (uint256) {
        EpochRewards storage epoch = epochs[epochId];
        
        if (!epoch.distributed || epoch.totalStakedInEpoch == 0) {
            return 0;
        }
        
        UserEpochStake storage userStake = epoch.userStakes[user];
        if (userStake.totalStakedAmount == 0) {
            return 0;
        }
        
        uint256 totalRewardForToken = epoch.rewardAmountPerToken[token];
        if (totalRewardForToken == 0) {
            return 0;
        }
        
        // Calculate proportional share
        // User's share = (User's stake / Total stake) × Total rewards
        return (userStake.totalStakedAmount * totalRewardForToken) / epoch.totalStakedInEpoch;
    }
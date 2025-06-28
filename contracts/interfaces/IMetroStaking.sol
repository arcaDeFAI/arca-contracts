// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

/**
 * @title IMetroStaking Interface
 * @dev Complete interface for the Metro Staking contract
 * @notice This interface defines all external functions for the NFT-based staking system
 */
interface IMetroStaking is IERC721, IERC721Enumerable {
    
    // ============ STRUCTS ============
    
    /**
     * @dev Staking position data structure
     */
    struct StakingPosition {
        uint256 initialLockDuration;    // Original lock duration when position was created
        uint256 amount;                 // Amount of staked tokens
        uint256 rewardDebt;            // Reward debt for accurate reward calculation
        uint256 lockDuration;          // Current lock duration
        uint256 startLockTime;         // When the current lock period started
        uint256 lockMultiplier;        // Lock-based multiplier bonus
        uint256 amountWithMultiplier;  // Staked amount including all multipliers
        uint256 totalMultiplier;       // Total combined multiplier
    }

    // ============ EVENTS ============
    
    event CreatePosition(uint256 indexed tokenId, uint256 amount, uint256 lockDuration);
    event AddToPosition(uint256 indexed tokenId, address indexed user, uint256 amountAdded);
    event WithdrawFromPosition(uint256 indexed tokenId, uint256 amountWithdrawn);
    event HarvestPosition(uint256 indexed tokenId, address indexed to, uint256 rewardAmount);
    event LockPosition(uint256 indexed tokenId, uint256 lockDuration);
    event EmergencyWithdraw(uint256 indexed tokenId, uint256 amount);
    event PoolUpdated(uint256 timestamp, uint256 accRewardsPerShare);
    event SetLockMultiplierSettings(uint256 maxLockDuration, uint256 maxLockMultiplier);
    event SetMinimumLockDuration(uint256 minimumLockDuration);
    event SetEmergencyUnlock(bool emergencyUnlock);

    // ============ CUSTOM ERRORS ============
    
    error IMetroStaking_ZeroAddress();
    error IMetroStaking_SameAddress();
    error IMetroStaking_TooMuchTokenDecimals();
    error IMetroStaking_ZeroAmount();
    error IMetroStaking_LocksDisabled();
    error IMetroStaking_InvalidLockDuration();
    error IMetroStaking_PositionStillLocked();
    error IMetroStaking_AmountTooHigh();
    error IMetroStaking_NotOwner();
    error IMetroStaking_TransferNotAllowed();
    error IMetroStaking_MaxLockMultiplierTooHigh();

    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Check if a token ID exists
     * @param tokenId The NFT token ID to check
     * @return True if the token exists
     */
    function exists(uint256 tokenId) external view returns (bool);

    /**
     * @dev Get the staked token contract
     * @return The IERC20 interface of the staked token
     */
    function getStakedToken() external view returns (IERC20);

    /**
     * @dev Get the reward token contract
     * @return The IERC20 interface of the reward token
     */
    function getRewardToken() external view returns (IERC20);

    /**
     * @dev Get the last recorded reward balance
     * @return The last reward balance amount
     */
    function getLastRewardBalance() external view returns (uint256);

    /**
     * @dev Get the most recently minted token ID
     * @return The latest token ID
     */
    function lastTokenId() external view returns (uint256);

    /**
     * @dev Get total amount of staked tokens (without multipliers)
     * @return Total staked supply
     */
    function getStakedSupply() external view returns (uint256);

    /**
     * @dev Get total staked amount including all multipliers
     * @return Total staked supply with multipliers applied
     */
    function getStakedSupplyWithMultiplier() external view returns (uint256);

    /**
     * @dev Check if emergency unlock is activated
     * @return True if emergency unlock is active
     */
    function isUnlocked() external view returns (bool);

    /**
     * @dev Check if the pool has any deposits
     * @return True if there are active deposits
     */
    function hasDeposits() external view returns (bool);

    /**
     * @dev Calculate multiplier for a given lock duration
     * @param lockDuration Duration to lock tokens
     * @return The multiplier for the given duration
     */
    function getMultiplierByLockDuration(uint256 lockDuration) external view returns (uint256);

    /**
     * @dev Get complete staking position information
     * @param tokenId The NFT token ID
     * @return position Complete StakingPosition struct
     */
    function getStakingPosition(uint256 tokenId) external view returns (StakingPosition memory position);

    /**
     * @dev Calculate pending rewards for a position
     * @param tokenId The NFT token ID
     * @return Amount of pending rewards
     */
    function pendingRewards(uint256 tokenId) external view returns (uint256);

    /**
     * @dev Get multiplier settings
     * @return maxGlobalMultiplier Maximum global multiplier allowed
     * @return maxLockDuration Duration for maximum lock multiplier
     * @return maxLockMultiplier Maximum lock multiplier available
     */
    function getMultiplierSettings() external view returns (uint256, uint256, uint256);

    /**
     * @dev Get minimum lock duration required
     * @return Minimum lock duration in seconds
     */
    function getMinimumLockDuration() external view returns (uint256);

    // ============ USER FUNCTIONS ============

    /**
     * @dev Create a new staking position (mints NFT)
     * @param amount Amount of tokens to stake
     * @param lockDuration Duration to lock the tokens
     */
    function createPosition(uint256 amount, uint256 lockDuration) external;

    /**
     * @dev Add more tokens to an existing position
     * @param tokenId The NFT token ID of the position
     * @param amountToAdd Amount of tokens to add
     */
    function addToPosition(uint256 tokenId, uint256 amountToAdd) external;

    /**
     * @dev Harvest rewards from a single position
     * @param tokenId The NFT token ID to harvest from
     */
    function harvestPosition(uint256 tokenId) external;

    /**
     * @dev Harvest rewards from multiple positions
     * @param tokenIds Array of NFT token IDs to harvest from
     */
    function harvestPositions(uint256[] calldata tokenIds) external;

    /**
     * @dev Withdraw tokens from a position (must be unlocked)
     * @param tokenId The NFT token ID
     * @param amountToWithdraw Amount to withdraw
     */
    function withdrawFromPosition(uint256 tokenId, uint256 amountToWithdraw) external;

    /**
     * @dev Renew lock with the original lock duration
     * @param tokenId The NFT token ID
     */
    function renewLockPosition(uint256 tokenId) external;

    /**
     * @dev Extend lock duration to a longer period
     * @param tokenId The NFT token ID
     * @param lockDuration New lock duration (must be longer than current)
     */
    function extendLockPosition(uint256 tokenId, uint256 lockDuration) external;

    /**
     * @dev Emergency withdraw without rewards (for unlocked positions)
     * @param tokenId The NFT token ID
     */
    function emergencyWithdraw(uint256 tokenId) external;

    /**
     * @dev Update the reward pool state
     */
    function updatePool() external;

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Initialize the contract (called once after deployment)
     * @param initialOwner Address that will own the contract
     */
    function initialize(address initialOwner) external;

    /**
     * @dev Set lock multiplier settings
     * @param maxLockDuration Maximum lock duration for full multiplier
     * @param maxLockMultiplier Maximum multiplier percentage
     */
    function setLockMultiplierSettings(uint256 maxLockDuration, uint256 maxLockMultiplier) external;

    /**
     * @dev Set minimum lock duration
     * @param minimumLockDuration New minimum lock duration
     */
    function setMinimumLockDuration(uint256 minimumLockDuration) external;

    /**
     * @dev Set emergency unlock status
     * @param emergencyUnlock True to enable emergency unlock
     */
    function setEmergencyUnlock(bool emergencyUnlock) external;
}
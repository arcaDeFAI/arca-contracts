// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import {IMetroStaking} from "../interfaces/IMetroStaking.sol";

/**
 * @title nMETRO Token Staking Contract
 * @dev MVP implementation of time-locked staking with multipliers and penalty redistribution
 */
contract MetroStaking is ERC20, Ownable, ReentrancyGuard, Pausable {

    struct StakeInfo {
        uint256 amount;           // Original staked amount
        uint256 lockDuration;     // Lock period in seconds
        uint256 startTime;        // When the stake began
        uint256 multiplier;       // Reward multiplier (scaled by 100, so 150 = 1.5x)
        uint256 tokenID;          // Token ID of the NFT staked position
        bool active;              // Whether stake is still active
    }
    
    struct LockOption {
        uint256 duration;         // Lock duration in seconds
        uint256 multiplier;       // Reward multiplier (scaled by 100)
        uint256 basePenalty;      // Base penalty percentage (scaled by 100)
    }
    
    // Interface variable to access Metro Staking contract functions
    IMetroStaking public dStakingContract;

    // ✅ FIXED MAPPING STRUCTURE (Option B)
    mapping(address => uint256[]) public tokenID;      // User -> array of tokenIDs they own
    mapping(uint256 => StakeInfo) public userStakes;   // TokenID -> single StakeInfo
    
    // Available lock options
    LockOption[] public lockOptions;
    
    // Piggy bank for early exits (holds actual METRO tokens)
    uint256 public piggyBank;
    
    // Total amount currently staked
    uint256 public totalStaked;
    
    // Staked token Address (METRO token from Sonic blockchain)
    address public sToken;
    
    // Treasury address that receives 10% of penalties
    address public treasury;
    
    // Interface to interact with METRO token
    IERC20 public metroToken;

    // Constants
    uint256 private constant PERCENTAGE_BASE = 10000; // 100.00%
    uint256 private constant MULTIPLIER_BASE = 100;   // 1.00x
    
    // Fee distribution percentages (NEW: 90% piggy, 10% treasury)
    uint256 private constant PIGGY_BANK_SHARE = 9000;       // 90%
    uint256 private constant TREASURY_SHARE = 1000;         // 10%
    
    // ============ EVENTS ============
    event ContractInitialized(address indexed owner, address sToken, address dsContract, address treasury, string tokenName, string tokenSymbol, uint256 initialPiggyBank, bool startPaused);
    event SafelyStaked(address indexed user, uint256 indexed tokenId, uint256 amount, uint256 stakeIndex);
    event EarlyExit(address indexed user, uint256 indexed tokenId, uint256 amountReceived, uint256 penalty);
    event MaturedClaim(address indexed user, uint256 indexed tokenId, uint256 amountReceived);
    event PenaltyDistributed(uint256 toPiggyBank, uint256 toTreasury);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event PiggyBankUpdated(uint256 newBalance);
    
    // ============ ERRORS ============
    error StakeNotActive();
    error StakeAlreadyMatured();
    error InvalidTokenId();

    /**
     * @dev Constructor - Sets up the staking vault with all initial configurations
     * @param initialOwner Address that will own the contract (admin powers)
     * @param stakedToken Address of METRO token from Sonic blockchain
     * @param dexStakingContract Address of the dex staking contract
     * @param treasuryAddress Address that receives 10% of penalties
     * @param tokenName Name of the staking receipt token (e.g., "Metro Staked Token")
     * @param tokenSymbol Symbol of the staking receipt token (e.g., "nMETRO")
     * @param initialPiggyBank Initial liquidity for early exits (in wei)
     * @param startPaused Whether to start the contract in paused state (true for safety)
     */
    constructor(
        address initialOwner,
        address stakedToken,
        address dexStakingContract,
        address treasuryAddress,
        string memory tokenName,
        string memory tokenSymbol,
        uint256 initialPiggyBank,
        bool startPaused
    ) ERC20(tokenName, tokenSymbol) {
        
        // VALIDATION CHECKS (Safety first!)
        require(initialOwner != address(0), "Owner cannot be zero address");
        require(stakedToken != address(0), "Staked token Metro cannot be zero address");
        require(dexStakingContract != address(0), "Dex Staking Contract cannot be zero address");
        require(treasuryAddress != address(0), "Treasury cannot be zero address");
        require(bytes(tokenName).length > 0, "Token name cannot be empty");
        require(bytes(tokenSymbol).length > 0, "Token symbol cannot be empty");

        // Address of the METRO token to be staked
        sToken = stakedToken;
        metroToken = IERC20(stakedToken);
        
        // Treasury address for penalty distribution
        treasury = treasuryAddress;

        // Connect to the staking contract and create the variable to access the functions
        dStakingContract = IMetroStaking(dexStakingContract);
        
        // SET OWNERSHIP (Transfer ownership to specified address)
        _transferOwnership(initialOwner);
        
        // SET INITIAL PAUSE STATE (Start paused for safety during deployment)
        if (startPaused) {
            _pause();
        }
        
        // INITIALIZE LOCK OPTIONS (The different vault types)
        _initializeLockOptions();
        
        // SETUP INITIAL PIGGY BANK (Emergency exit liquidity)
        require(initialPiggyBank == 0, "Must be Zero");
        piggyBank = initialPiggyBank;
        
        // EMIT DEPLOYMENT EVENT
        emit ContractInitialized(initialOwner, stakedToken, dexStakingContract, treasuryAddress, tokenName, tokenSymbol, initialPiggyBank, startPaused);
    }

    /**
     * @dev Internal function to set up the three lock options
     */
    function _initializeLockOptions() internal {
        // BRONZE VAULT: 3 months - Lower risk, lower reward
        lockOptions.push(LockOption({
            duration: 90 days,      // 3 months lock
            multiplier: 150,        // 1.5x reward multiplier  
            basePenalty: 2500       // 25% base penalty for early exit
        }));
        
        // SILVER VAULT: 6 months - Medium risk, medium reward
        lockOptions.push(LockOption({
            duration: 180 days,     // 6 months lock
            multiplier: 200,        // 2.0x reward multiplier
            basePenalty: 3500       // 35% base penalty for early exit
        }));
        
        // GOLD VAULT: 12 months - Higher risk, higher reward
        lockOptions.push(LockOption({
            duration: 365 days,     // 12 months lock
            multiplier: 300,        // 3.0x reward multiplier
            basePenalty: 4500       // 45% base penalty for early exit
        }));
    }

    /**
     * @dev Deposit tokens into DEX staking positions and track locally
     * @param _amountM Amount of tokens to stake on DEX
     * @param _lockDuration Lock period duration
     */
    function Deposit(uint256 _amountM, uint256 _lockDuration) external nonReentrant whenNotPaused {
        require(_amountM > 0, "Amount to be staked must be greater than 0");
        require(_lockDuration > 0, "Lock duration must be greater than 0");
        require(address(dStakingContract) != address(0), "DEX contract not set");

        // Record user's NFT count BEFORE staking
        uint256 balanceBefore = dStakingContract.balanceOf(msg.sender);
        
        // Stake on DEX (mints NFT to msg.sender)
        dStakingContract.createPosition(_amountM, _lockDuration);
        
        // Verify exactly ONE new NFT was minted
        uint256 balanceAfter = dStakingContract.balanceOf(msg.sender);
        require(balanceAfter == balanceBefore + 1, "NFT not received");
        
        // Get the NEWEST token owned by this user
        uint256 newTokenId = dStakingContract.tokenOfOwnerByIndex(
            msg.sender, 
            balanceAfter - 1  // Last token in user's list
        );
        
        // Get the actual staking position from DEX to fill our struct
        IMetroStaking.StakingPosition memory dexPosition = dStakingContract.getStakingPosition(newTokenId);
        
        // Calculate multiplier based on our lock options (or use DEX multiplier)
        require(dexPosition.amountWithMultiplier > 0 && dexPosition.amount > 0, "amounts must be different than 0");
        uint256 multiplier = (dexPosition.amountWithMultiplier / dexPosition.amount);
        
        // ✅ FIXED: Store using correct mapping structure (Option B)
        // Store StakeInfo by tokenID
        userStakes[newTokenId] = StakeInfo({
            amount: dexPosition.amount,           // Use actual amount from DEX
            lockDuration: dexPosition.lockDuration,
            startTime: dexPosition.startLockTime,
            multiplier: multiplier,
            tokenID: newTokenId,                  // Store the NFT token ID
            active: true
        });
        
        // ✅ FIXED: Track this tokenID for the user
        tokenID[msg.sender].push(newTokenId);
        
        // Update our internal tracking
        totalStaked += dexPosition.amount;
        
        // 🏭 MINT nMETRO tokens (liquid tokens user can trade)
        uint256 tokensToMint = (dexPosition.amount * multiplier) / MULTIPLIER_BASE;
        _mint(msg.sender, tokensToMint);
        
        // Emit event with stakeIndex for easy tracking
        uint256 stakeIndex = tokenID[msg.sender].length - 1;
        emit SafelyStaked(msg.sender, newTokenId, dexPosition.amount, stakeIndex);
    }

    // ============ EARLY EXIT FUNCTIONS ============
    
    /**
     * @dev Early exit from staking position - Must burn nMETRO to exit
     * @param _tokenId The token ID to exit from
     */
    function earlyExit(uint256 _tokenId) external nonReentrant whenNotPaused {
        // Step 1: Get our local stake info
        StakeInfo storage stakeInfo = userStakes[_tokenId];
        require(stakeInfo.active, "Stake is not active");
        require(stakeInfo.tokenID != 0, "Invalid token ID");
        
        // Step 2: Check if stake is still locked (not matured)
        require(block.timestamp < stakeInfo.startTime + stakeInfo.lockDuration, "Stake has matured, use claimMatured instead");
        
        // Step 3: Calculate how much nMETRO user must burn (same amount they got)
        uint256 nMetroToBurn = (stakeInfo.amount * stakeInfo.multiplier) / MULTIPLIER_BASE;
        require(balanceOf(msg.sender) >= nMetroToBurn, "Insufficient nMETRO balance");
        
        // Step 4: Calculate penalty and fair share
        (uint256 penalty, uint256 amountAfterPenalty) = _calculateEarlyExitPenalty(_tokenId);
        uint256 fairShare = _calculateFairShare(stakeInfo.amount);
        
        // Step 5: Update state BEFORE external calls
        stakeInfo.active = false;
        totalStaked -= stakeInfo.amount;
        
        // Step 6: Burn nMETRO tokens from user
        _burn(msg.sender, nMetroToBurn);
        
        // Step 7: Call DEX emergency withdraw to get original METRO back to our contract
        dStakingContract.emergencyWithdraw(_tokenId);
        
        // Step 8: Transfer user their share (original METRO + piggy bank share - penalty)
        uint256 userReceives = amountAfterPenalty + fairShare;
        require(metroToken.balanceOf(address(this)) >= userReceives, "Insufficient METRO balance");
        metroToken.transfer(msg.sender, userReceives);
        
        // Step 9: Add penalty to piggy bank for future users
        // Penalty stays in contract's METRO balance, increasing piggy bank
        
        // Step 10: Emit event
        emit EarlyExit(msg.sender, _tokenId, userReceives, penalty);
    }
    
    /**
     * @dev Claim matured position - Must burn nMETRO to claim
     * @param _tokenId The token ID to claim
     */
    function claimMatured(uint256 _tokenId) external nonReentrant whenNotPaused {
        // Step 1: Get our local stake info
        StakeInfo storage stakeInfo = userStakes[_tokenId];
        require(stakeInfo.active, "Stake is not active");
        require(stakeInfo.tokenID != 0, "Invalid token ID");
        
        // Step 2: Check if stake has matured
        require(block.timestamp >= stakeInfo.startTime + stakeInfo.lockDuration, "Stake not yet matured");
        
        // Step 3: Calculate how much nMETRO user must burn
        uint256 nMetroToBurn = (stakeInfo.amount * stakeInfo.multiplier) / MULTIPLIER_BASE;
        require(balanceOf(msg.sender) >= nMetroToBurn, "Insufficient nMETRO balance");
        
        // Step 4: Calculate maturity bonus (40% of what their exit capacity would be)
        // At maturity: no time penalty, so full exit capacity available
        uint256 fullExitCapacity = _calculateExitCapacity(nMetroToBurn);
        uint256 maturityBonus = (fullExitCapacity * 4000) / PERCENTAGE_BASE; // 40%
        
        // Step 5: Update state BEFORE external calls
        stakeInfo.active = false;
        totalStaked -= stakeInfo.amount;
        
        // Step 6: Burn nMETRO tokens from user
        _burn(msg.sender, nMetroToBurn);
        
        // Step 7: Harvest from DEX to get rewards (if any)
        dStakingContract.harvestPosition(_tokenId);
        
        // Step 8: Transfer user their original stake + maturity bonus
        uint256 totalReceived = stakeInfo.amount + maturityBonus;
        require(metroToken.balanceOf(address(this)) >= totalReceived, "Insufficient METRO balance");
        metroToken.transfer(msg.sender, totalReceived);
        
        // Step 9: The remaining 60% of exit capacity stays in piggy bank for others
        // (This automatically happens since we only gave 40%)
        
        // Step 10: Emit event
        emit MaturedClaim(msg.sender, _tokenId, totalReceived);
    }
      /**
     * @dev Distribute penalty: 90% stays in contract (piggy bank), 10% to treasury
     * @param penaltyAmount Amount of METRO penalty to distribute
     */
    function _distributePenalty(uint256 penaltyAmount) internal {
        if (penaltyAmount == 0) return;
        
        uint256 toTreasury = (penaltyAmount * TREASURY_SHARE) / PERCENTAGE_BASE; // 10%
        uint256 toPiggyBank = penaltyAmount - toTreasury; // 90% (stays in contract)
        
        // Send 10% to treasury
        if (toTreasury > 0) {
            metroToken.transfer(treasury, toTreasury);
        }
        
        // 90% stays in contract, automatically increases piggy bank for all users
        // (The penalty METRO stays in contract balance, increasing everyone's fair shares)
        
        emit PenaltyDistributed(toPiggyBank, toTreasury);
    }


    /**
     * @dev Calculate user's fair share of piggy bank based on their stake
     * @param stakeAmount User's original stake amount
     * @return fairShare Amount of METRO from piggy bank
     */
    function _calculateFairShare(uint256 stakeAmount) internal view returns (uint256) {
        uint256 totalMETROInContract = metroToken.balanceOf(address(this));
        
        if (totalStaked == 0 || totalMETROInContract == 0) {
            return 0;
        }
        
        // Fair share = (User's Stake / Total Staked) × Total METRO in Piggy Bank
        return (stakeAmount * totalMETROInContract) / totalStaked;
    }
    
    /**
     * @dev Calculate exit capacity based on piggy bank liquidity
     * Your Exit Capacity = (Piggy Bank / Total nMETRO Supply) - simplified
     */
    function _calculateExitCapacity(uint256 stakeAmount) internal view returns (uint256) {
        uint256 totalSupply = totalSupply();
        
        if (totalSupply == 0 || piggyBank == 0) {
            return 0;
        }
        
        // Calculate proportional capacity
        uint256 capacity = (piggyBank * PERCENTAGE_BASE) / totalSupply;
        
        // Cap at 100% (10000 in basis points)
        return capacity > PERCENTAGE_BASE ? PERCENTAGE_BASE : capacity;
    }
    
    /**
     * @dev Calculate early exit penalty based on time remaining
     * @param _tokenId Token ID to calculate penalty for
     * @return penalty Amount of penalty
     * @return amountAfterPenalty Amount user receives after penalty
     */
    function _calculateEarlyExitPenalty(uint256 _tokenId) internal view returns (uint256 penalty, uint256 amountAfterPenalty) {
        StakeInfo memory stakeInfo = userStakes[_tokenId];
        
        // Calculate time remaining
        uint256 timeRemaining = (stakeInfo.startTime + stakeInfo.lockDuration) - block.timestamp;
        
        // Get base penalty from our lock options
        uint256 basePenalty = _getBasePenaltyForDuration(stakeInfo.lockDuration);
        
        // Calculate time-decayed penalty
        uint256 currentPenalty = (basePenalty * timeRemaining) / stakeInfo.lockDuration;
        
        // Calculate amounts
        penalty = (stakeInfo.amount * currentPenalty) / PERCENTAGE_BASE;
        amountAfterPenalty = stakeInfo.amount - penalty;
    }
    
    /**
     * @dev Get base penalty percentage for a given lock duration
     * @param lockDuration Duration to find penalty for
     * @return basePenalty Base penalty percentage (scaled by PERCENTAGE_BASE)
     */
    function _getBasePenaltyForDuration(uint256 lockDuration) internal view returns (uint256 basePenalty) {
        // Find matching lock option
        for (uint256 i = 0; i < lockOptions.length; i++) {
            if (lockDuration >= lockOptions[i].duration) {
                return lockOptions[i].basePenalty;
            }
        }
        
        // Default penalty if no match found
        return 2500; // 25%
    }
    
    
    /**
     * @dev Preview early exit with correct capacity calculation
     * @param _tokenId Token ID to check
     * @return nMetroToBurn Amount of nMETRO user must burn
     * @return timePenalty Time-based penalty amount
     * @return amountAfterPenalty Amount after time penalty
     * @return exitCapacity Available exit capacity for this position
     * @return finalAmount Final amount user receives (min of penalty and capacity)
     * @return actualPenalty Total penalty (original - final)
     * @return canExit Whether exit is possible
     */
    function previewEarlyExit(uint256 _tokenId) external view returns (
        uint256 nMetroToBurn,
        uint256 timePenalty,
        uint256 amountAfterPenalty,
        uint256 exitCapacity,
        uint256 finalAmount,
        uint256 actualPenalty,
        bool canExit
    ) {
        StakeInfo memory stakeInfo = userStakes[_tokenId];
        
        // Check if stake exists and is active
        if (!stakeInfo.active || stakeInfo.tokenID == 0) {
            return (0, 0, 0, 0, 0, 0, false);
        }
        
        // Check if still locked
        if (block.timestamp >= stakeInfo.startTime + stakeInfo.lockDuration) {
            return (0, 0, 0, 0, 0, 0, false); // Should use claimMatured
        }
        
        // Calculate values
        nMetroToBurn = (stakeInfo.amount * stakeInfo.multiplier) / MULTIPLIER_BASE;
        (timePenalty, amountAfterPenalty) = _calculateEarlyExitPenalty(_tokenId);
        exitCapacity = _calculateExitCapacity(nMetroToBurn);
        
        // Final amount is minimum of penalty amount and available capacity
        finalAmount = amountAfterPenalty < exitCapacity ? amountAfterPenalty : exitCapacity;
        actualPenalty = stakeInfo.amount - finalAmount;
        
        // Check if user has enough nMETRO and contract has enough METRO
        canExit = balanceOf(msg.sender) >= nMetroToBurn && 
                  metroToken.balanceOf(address(this)) >= finalAmount;
    }
    
    /**
     * @dev Preview matured claim amounts (view function for UI)  
     * @param _tokenId Token ID to check
     * @return nMetroToBurn Amount of nMETRO user must burn
     * @return originalStake User's original stake amount
     * @return fullExitCapacity What their exit capacity would be (no penalty)
     * @return maturityBonus 40% of their exit capacity
     * @return totalReceived Total METRO user would receive
     * @return remainsInPiggy 60% that stays in piggy bank
     * @return canClaim Whether claim is possible
     */
    function previewMaturedClaim(uint256 _tokenId) external view returns (
        uint256 nMetroToBurn,
        uint256 originalStake,
        uint256 fullExitCapacity,
        uint256 maturityBonus,
        uint256 totalReceived,
        uint256 remainsInPiggy,
        bool canClaim
    ) {
        StakeInfo memory stakeInfo = userStakes[_tokenId];
        
        // Check if stake exists and is active
        if (!stakeInfo.active || stakeInfo.tokenID == 0) {
            return (0, 0, 0, 0, 0, 0, false);
        }
        
        // Check if matured
        if (block.timestamp < stakeInfo.startTime + stakeInfo.lockDuration) {
            return (0, 0, 0, 0, 0, 0, false); // Not yet matured
        }
        
        // Calculate amounts
        nMetroToBurn = (stakeInfo.amount * stakeInfo.multiplier) / MULTIPLIER_BASE;
        originalStake = stakeInfo.amount;
        fullExitCapacity = _calculateExitCapacity(nMetroToBurn);
        maturityBonus = (fullExitCapacity * 4000) / PERCENTAGE_BASE; // 40%
        totalReceived = originalStake + maturityBonus;
        remainsInPiggy = (fullExitCapacity * 6000) / PERCENTAGE_BASE; // 60% stays
        
        // Check if user has enough nMETRO and contract has enough METRO
        canClaim = balanceOf(msg.sender) >= nMetroToBurn && 
                   metroToken.balanceOf(address(this)) >= totalReceived;
    }
    function previewEarlyExit(uint256 _tokenId) external view returns (
        uint256 penalty, 
        uint256 amountAfterPenalty,
        uint256 finalAmount,
        uint256 exitCapacity,
        bool canExit
    ) {
        StakeInfo memory stakeInfo = userStakes[_tokenId];
        
        // Check if stake exists and is active
        if (!stakeInfo.active || stakeInfo.tokenID == 0) {
            return (0, 0, 0, 0, false);
        }
        
        // Check if still locked
        if (block.timestamp >= stakeInfo.startTime + stakeInfo.lockDuration) {
            return (0, stakeInfo.amount, stakeInfo.amount, PERCENTAGE_BASE, false); // Matured
        }
        
        // Calculate penalty
        (penalty, amountAfterPenalty) = _calculateEarlyExitPenalty(_tokenId);
        
        // Calculate exit capacity
        exitCapacity = _calculateExitCapacity(stakeInfo.amount);
        
        // Apply capacity limit
        finalAmount = (amountAfterPenalty * exitCapacity) / PERCENTAGE_BASE;
        
        // Check if piggy bank has enough liquidity
        canExit = piggyBank >= finalAmount && finalAmount > 0;
    }
    
    /**
     * @dev Update treasury address (owner only)
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury cannot be zero address");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @dev Add METRO tokens to piggy bank (owner only)
     * @param amount Amount of METRO tokens to add
     */
    function addMETROToPiggyBank(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(metroToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit PiggyBankUpdated(metroToken.balanceOf(address(this)));
    }
    
    /**
     * @dev Get piggy bank and contract info
     */
    function getContractInfo() external view returns (
        uint256 totalMetroInContract,
        uint256 totalNMetroSupply,
        uint256 totalStaked,
        uint256 contractMetroBalance
    ) {
        totalMetroInContract = metroToken.balanceOf(address(this));
        totalNMetroSupply = totalSupply();
        totalStaked = totalStaked;
        contractMetroBalance = totalMetroInContract;
    }
    
    /**
     * @dev Get user's token count
     */
    function getUserTokenCount(address user) external view returns (uint256) {
        return tokenID[user].length;
    }
    
    /**
     * @dev Get user's specific token ID by index
     */
    function getUserTokenByIndex(address user, uint256 index) external view returns (uint256) {
        require(index < tokenID[user].length, "Index out of bounds");
        return tokenID[user][index];
    }
    
    /**
     * @dev Get stake info by token ID
     */
    function getStakeByTokenId(uint256 _tokenId) external view returns (StakeInfo memory) {
        return userStakes[_tokenId];
    }
    
    /**
     * @dev Get all user's token IDs
     */
    function getAllUserTokens(address user) external view returns (uint256[] memory) {
        return tokenID[user];
    }

    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Pause contract (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
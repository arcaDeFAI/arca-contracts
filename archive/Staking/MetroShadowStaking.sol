// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title nMETRO & nShadow Staking Contract
 * @dev Complete staking system with penalty/reward redistribution for METRO tokens
 *      and simple staking for X33 tokens
 */
contract MetroShadowStaking is ReentrancyGuard, Ownable, Pausable {
    // Token interfaces
    IERC20 public immutable METRO_TOKEN;
    IERC20 public immutable X33_TOKEN;
    ERC20 public immutable NMETRO_TOKEN;
    ERC20 public immutable NSHADOW_TOKEN;

    // Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant TEAM_FEE = 1000; // 10%
    uint256 public constant PIGGY_BANK_SHARE = 4000; // 40%
    uint256 public constant STAKER_REWARD_SHARE = 5000; // 50%

    // Staking multipliers and lock periods
    struct StakingTier {
        uint256 multiplier; // 150 = 1.5x, 200 = 2x, 300 = 3x
        uint256 lockPeriod; // in seconds
        uint256 penaltyRate; // basis points (3500 = 35%, 2500 = 25%, 1500 = 15%)
    }

    mapping(uint256 => StakingTier) public stakingTiers; // 0 = 1.5x, 1 = 2x, 2 = 3x

    // METRO staking positions
    struct MetroStakePosition {
        uint256 amount; // Original METRO staked
        uint256 nMetroAmount; // nMETRO tokens minted
        uint256 startTime;
        uint256 unlockTime;
        uint256 tierId;
        bool isActive;
        uint256 rebaseRewardsReceived; // Tracks gradual repayment
    }

    // X33 staking positions (simple staking)
    struct X33StakePosition {
        uint256 amount; // X33 staked
        uint256 nShadowAmount; // nShadow tokens minted (1:1 ratio)
        uint256 startTime;
        bool isActive;
    }

    // User positions
    mapping(address => MetroStakePosition[]) public userMetroPositions;
    mapping(address => X33StakePosition[]) public userX33Positions;

    // Emergency exit piggy bank
    uint256 public piggyBankBalance;
    uint256 public totalPendingRewards; // Rewards waiting for gradual distribution

    // Global tracking
    uint256 public totalMetroStaked;
    uint256 public totalNMetroMinted;
    uint256 public totalX33Staked;
    uint256 public totalNShadowMinted;

    // Rebase tracking for gradual repayment
    mapping(address => uint256) public userRebaseIndex; // Last rebase index user participated in
    uint256 public globalRebaseIndex; // Global rebase counter
    uint256 public rebaseRewardsPerToken; // Accumulated rewards per token

    // Events
    event MetroStaked(
        address indexed user,
        uint256 amount,
        uint256 nMetroMinted,
        uint256 tierId,
        uint256 positionIndex
    );
    event X33Staked(
        address indexed user,
        uint256 amount,
        uint256 nShadowMinted,
        uint256 positionIndex
    );
    event EarlyExit(
        address indexed user,
        uint256 positionIndex,
        uint256 amountReceived,
        uint256 penalty
    );
    event RegularUnlock(
        address indexed user,
        uint256 positionIndex,
        uint256 amount
    );
    event X33Unstaked(
        address indexed user,
        uint256 positionIndex,
        uint256 amount
    );
    event RebaseDistributed(uint256 totalRewards, uint256 rewardsPerToken);
    event PiggyBankUpdated(uint256 newBalance);

    constructor(
        address _metroToken,
        address _x33Token,
        address _nMetroToken,
        address _nShadowToken
    ) Ownable(msg.sender) {
        METRO_TOKEN = IERC20(_metroToken);
        X33_TOKEN = IERC20(_x33Token);
        NMETRO_TOKEN = ERC20(_nMetroToken);
        NSHADOW_TOKEN = ERC20(_nShadowToken);

        // Initialize staking tiers
        stakingTiers[0] = StakingTier(150, 90 days, 3500); // 1.5x, 3 months, 35% penalty
        stakingTiers[1] = StakingTier(200, 180 days, 2500); // 2x, 6 months, 25% penalty
        stakingTiers[2] = StakingTier(300, 365 days, 1500); // 3x, 12 months, 15% penalty
    }

    // ==================== METRO STAKING FUNCTIONS ====================

    /**
     * @dev Stake METRO tokens for nMETRO with chosen multiplier and lock period
     */
    function stakeMetro(
        uint256 amount,
        uint256 tierId
    ) external nonReentrant whenNotPaused {
        require(tierId <= 2, "Invalid tier ID");
        require(amount > 0, "Amount must be greater than 0");

        StakingTier memory tier = stakingTiers[tierId];
        require(
            METRO_TOKEN.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        // Calculate nMETRO to mint based on multiplier
        uint256 nMetroToMint = (amount * tier.multiplier) / 100;

        // Create new position
        MetroStakePosition memory newPosition = MetroStakePosition({
            amount: amount,
            nMetroAmount: nMetroToMint,
            startTime: block.timestamp,
            unlockTime: block.timestamp + tier.lockPeriod,
            tierId: tierId,
            isActive: true,
            rebaseRewardsReceived: 0
        });

        userMetroPositions[msg.sender].push(newPosition);
        uint256 positionIndex = userMetroPositions[msg.sender].length - 1;

        // Update global tracking
        totalMetroStaked += amount;
        totalNMetroMinted += nMetroToMint;

        // Mint nMETRO tokens to user
        // Note: This assumes nMETRO contract has a mint function accessible by this contract
        // NMETRO_TOKEN.mint(msg.sender, nMetroToMint);

        // Update user's rebase index to current global index
        userRebaseIndex[msg.sender] = globalRebaseIndex;

        emit MetroStaked(
            msg.sender,
            amount,
            nMetroToMint,
            tierId,
            positionIndex
        );
    }

    /**
     * @dev Emergency exit with penalty (uses piggy bank if available)
     */
    function emergencyExit(uint256 positionIndex) external nonReentrant {
        require(
            positionIndex < userMetroPositions[msg.sender].length,
            "Invalid position"
        );
        MetroStakePosition storage position = userMetroPositions[msg.sender][
            positionIndex
        ];
        require(position.isActive, "Position not active");
        require(
            block.timestamp < position.unlockTime,
            "Position already unlocked"
        );

        StakingTier memory tier = stakingTiers[position.tierId];

        // Calculate time-based penalty
        uint256 timeRemaining = position.unlockTime - block.timestamp;
        uint256 totalLockTime = tier.lockPeriod;
        uint256 timeRatio = (timeRemaining * BASIS_POINTS) / totalLockTime;

        // Current penalty = base penalty * time ratio
        uint256 currentPenalty = (tier.penaltyRate * timeRatio) / BASIS_POINTS;
        uint256 penaltyAmount = (position.amount * currentPenalty) /
            BASIS_POINTS;
        uint256 userReceives = position.amount - penaltyAmount;

        // Check if piggy bank can cover the exit
        uint256 availableInPiggyBank = piggyBankBalance;
        require(
            userReceives <= availableInPiggyBank,
            "Insufficient piggy bank funds"
        );

        // Deactivate position
        position.isActive = false;

        // Update tracking
        totalMetroStaked -= position.amount;
        totalNMetroMinted -= position.nMetroAmount;
        piggyBankBalance -= userReceives;

        // Distribute penalty: 40% to piggy bank, 50% to pending rewards, 10% to team
        uint256 toPiggyBank = (penaltyAmount * PIGGY_BANK_SHARE) / BASIS_POINTS;
        uint256 toStakers = (penaltyAmount * STAKER_REWARD_SHARE) /
            BASIS_POINTS;
        uint256 toTeam = penaltyAmount - toPiggyBank - toStakers;

        piggyBankBalance += toPiggyBank;
        totalPendingRewards += toStakers;

        // Send tokens to user and team
        require(
            METRO_TOKEN.transfer(msg.sender, userReceives),
            "User transfer failed"
        );
        require(METRO_TOKEN.transfer(owner(), toTeam), "Team transfer failed");

        // Burn user's nMETRO tokens
        // NMETRO_TOKEN.burnFrom(msg.sender, position.nMetroAmount);

        // Trigger rebase distribution if enough rewards accumulated
        if (totalPendingRewards >= totalNMetroMinted / 100) {
            // Trigger when rewards >= 1% of total supply
            _distributeRebaseRewards();
        }

        emit EarlyExit(msg.sender, positionIndex, userReceives, penaltyAmount);
        emit PiggyBankUpdated(piggyBankBalance);
    }

    /**
     * @dev Regular unlock when lock period expires
     */
    function unlockMetro(uint256 positionIndex) external nonReentrant {
        require(
            positionIndex < userMetroPositions[msg.sender].length,
            "Invalid position"
        );
        MetroStakePosition storage position = userMetroPositions[msg.sender][
            positionIndex
        ];
        require(position.isActive, "Position not active");
        require(
            block.timestamp >= position.unlockTime,
            "Position still locked"
        );

        // Claim any pending rebase rewards first
        _claimRebaseRewards(msg.sender);

        // Deactivate position
        position.isActive = false;

        // Update tracking
        totalMetroStaked -= position.amount;
        totalNMetroMinted -= position.nMetroAmount;

        // Return original METRO + any accumulated rewards
        uint256 totalToReturn = position.amount +
            position.rebaseRewardsReceived;
        require(
            METRO_TOKEN.transfer(msg.sender, totalToReturn),
            "Transfer failed"
        );

        // Burn user's nMETRO tokens
        // NMETRO_TOKEN.burnFrom(msg.sender, position.nMetroAmount);

        emit RegularUnlock(msg.sender, positionIndex, totalToReturn);
    }

    /**
     * @dev Internal function to distribute rebase rewards to all stakers
     */
    function _distributeRebaseRewards() internal {
        if (totalPendingRewards == 0 || totalNMetroMinted == 0) return;

        uint256 rewardsPerTokenIncrease = (totalPendingRewards * 1e18) /
            totalNMetroMinted;
        rebaseRewardsPerToken += rewardsPerTokenIncrease;
        globalRebaseIndex++;

        totalPendingRewards = 0;

        emit RebaseDistributed(totalPendingRewards, rewardsPerTokenIncrease);
    }

    /**
     * @dev Internal function to claim accumulated rebase rewards for a user
     */
    function _claimRebaseRewards(address user) internal {
        if (userRebaseIndex[user] >= globalRebaseIndex) return;

        uint256 userTotalNMetro = 0;
        MetroStakePosition[] storage positions = userMetroPositions[user];

        // Calculate total active nMETRO for user
        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i].isActive) {
                userTotalNMetro += positions[i].nMetroAmount;
            }
        }

        if (userTotalNMetro == 0) return;

        // Calculate rewards since last claim
        uint256 rewardsSinceLastClaim = (userTotalNMetro *
            (rebaseRewardsPerToken - (userRebaseIndex[user] * 1e18))) / 1e18;

        if (rewardsSinceLastClaim > 0) {
            // Distribute rewards proportionally across active positions
            for (uint256 i = 0; i < positions.length; i++) {
                if (positions[i].isActive) {
                    uint256 positionReward = (rewardsSinceLastClaim *
                        positions[i].nMetroAmount) / userTotalNMetro;
                    positions[i].rebaseRewardsReceived += positionReward;
                }
            }
        }

        userRebaseIndex[user] = globalRebaseIndex;
    }

    // ==================== X33 STAKING FUNCTIONS ====================

    /**
     * @dev Stake X33 tokens for nShadow (1:1 ratio, no lock period)
     */
    function stakeX33(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(
            X33_TOKEN.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        // Create new X33 position (1:1 ratio)
        X33StakePosition memory newPosition = X33StakePosition({
            amount: amount,
            nShadowAmount: amount, // 1:1 ratio
            startTime: block.timestamp,
            isActive: true
        });

        userX33Positions[msg.sender].push(newPosition);
        uint256 positionIndex = userX33Positions[msg.sender].length - 1;

        // Update global tracking
        totalX33Staked += amount;
        totalNShadowMinted += amount;

        // Mint nShadow tokens to user
        // NSHADOW_TOKEN.mint(msg.sender, amount);

        emit X33Staked(msg.sender, amount, amount, positionIndex);
    }

    /**
     * @dev Unstake X33 tokens (no penalty, instant unlock)
     */
    function unstakeX33(uint256 positionIndex) external nonReentrant {
        require(
            positionIndex < userX33Positions[msg.sender].length,
            "Invalid position"
        );
        X33StakePosition storage position = userX33Positions[msg.sender][
            positionIndex
        ];
        require(position.isActive, "Position not active");

        // Deactivate position
        position.isActive = false;

        // Update tracking
        totalX33Staked -= position.amount;
        totalNShadowMinted -= position.nShadowAmount;

        // Return X33 tokens
        require(
            X33_TOKEN.transfer(msg.sender, position.amount),
            "Transfer failed"
        );

        // Burn user's nShadow tokens
        // NSHADOW_TOKEN.burnFrom(msg.sender, position.nShadowAmount);

        emit X33Unstaked(msg.sender, positionIndex, position.amount);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @dev Get user's METRO staking positions
     */
    function getUserMetroPositions(
        address user
    ) external view returns (MetroStakePosition[] memory) {
        return userMetroPositions[user];
    }

    /**
     * @dev Get user's X33 staking positions
     */
    function getUserX33Positions(
        address user
    ) external view returns (X33StakePosition[] memory) {
        return userX33Positions[user];
    }

    /**
     * @dev Calculate current penalty for early exit
     */
    function calculateCurrentPenalty(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        require(
            positionIndex < userMetroPositions[user].length,
            "Invalid position"
        );
        MetroStakePosition memory position = userMetroPositions[user][
            positionIndex
        ];

        if (!position.isActive || block.timestamp >= position.unlockTime) {
            return 0;
        }

        StakingTier memory tier = stakingTiers[position.tierId];
        uint256 timeRemaining = position.unlockTime - block.timestamp;
        uint256 totalLockTime = tier.lockPeriod;
        uint256 timeRatio = (timeRemaining * BASIS_POINTS) / totalLockTime;

        return (tier.penaltyRate * timeRatio) / BASIS_POINTS;
    }

    /**
     * @dev Get available piggy bank capacity for emergency exits
     */
    function getAvailableExitCapacity() external view returns (uint256) {
        return piggyBankBalance;
    }

    /**
     * @dev Get user's pending rebase rewards
     */
    function getPendingRebaseRewards(
        address user
    ) external view returns (uint256) {
        if (userRebaseIndex[user] >= globalRebaseIndex) return 0;

        uint256 userTotalNMetro = 0;
        MetroStakePosition[] memory positions = userMetroPositions[user];

        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i].isActive) {
                userTotalNMetro += positions[i].nMetroAmount;
            }
        }

        if (userTotalNMetro == 0) return 0;

        return
            (userTotalNMetro *
                (rebaseRewardsPerToken - (userRebaseIndex[user] * 1e18))) /
            1e18;
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @dev Update staking tier parameters (only owner)
     */
    function updateStakingTier(
        uint256 tierId,
        uint256 multiplier,
        uint256 lockPeriod,
        uint256 penaltyRate
    ) external onlyOwner {
        require(tierId <= 2, "Invalid tier ID");
        require(penaltyRate <= BASIS_POINTS, "Invalid penalty rate");

        stakingTiers[tierId] = StakingTier(multiplier, lockPeriod, penaltyRate);
    }

    /**
     * @dev Manual rebase distribution trigger (only owner)
     */
    function triggerRebaseDistribution() external onlyOwner {
        _distributeRebaseRewards();
    }

    /**
     * @dev Emergency withdrawal function (only owner)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner {
        require(IERC20(token).transfer(owner(), amount), "Transfer failed");
    }

    /**
     * @dev Pause/unpause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}

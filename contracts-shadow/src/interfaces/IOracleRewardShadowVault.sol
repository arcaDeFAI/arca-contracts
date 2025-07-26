// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {IERC20Upgradeable} from "openzeppelin-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IRamsesV3Pool} from "../RamsesV3Pool.sol";
import {IMinimalVault} from "../../../contracts-metropolis/src/interfaces/IMinimalVault.sol";
import {IShadowStrategy} from "./IShadowStrategy.sol";
import {IVaultFactory} from "../../../contracts-metropolis/src/interfaces/IVaultFactory.sol";
import {IOracleHelper} from "../../../contracts-metropolis/src/interfaces/IOracleHelper.sol";
import {IERC20} from "../../../contracts-metropolis/src/interfaces/IHooksRewarder.sol";

/**
 * @title Oracle Reward Shadow Vault Interface
 * @author Arca
 * @notice Interface for Shadow vaults with oracle pricing and reward distribution
 */
interface IOracleRewardShadowVault is IMinimalVault, IERC20Upgradeable {
    // Errors
    error ShadowVault__InvalidPool();
    error ShadowVault__InvalidToken();
    error ShadowVault__InvalidStrategy();
    error ShadowVault__OnlyFactory();
    error ShadowVault__OnlyStrategy();
    error ShadowVault__ZeroAmount();
    error ShadowVault__ZeroShares();
    error ShadowVault__DepositsPaused();
    error ShadowVault__InsufficientBalance();
    error ShadowVault__NotInEmergencyMode();
    error ShadowVault__WithdrawLocked();
    error ShadowVault__InvalidRound();
    error ShadowVault__NoQueuedWithdrawal();
    error ShadowVault__Unauthorized();
    error ShadowVault__NativeTransferFailed();
    error ShadowVault__OnlyWNative();
    error ShadowVault__InvalidNativeAmount();
    error ShadowVault__MaxSharesExceeded();

    // Events
    event StrategySet(IShadowStrategy strategy);
    event Deposited(address indexed sender, uint256 amountX, uint256 amountY, uint256 shares);
    event WithdrawalQueued(address indexed sender, uint256 round, uint256 shares);
    event WithdrawalExecuted(uint256 indexed round, uint256 totalQueuedShares, uint256 amountX, uint256 amountY);
    event WithdrawalRedeemed(address indexed sender, address indexed receiver, uint256 indexed round, uint256 shares, uint256 amountX, uint256 amountY);
    event EmergencyMode();
    event Recovered(address token, address recipient, uint256 amount);
    event DepositsPaused();
    event DepositsResumed();
    event PoolUpdated(uint256 timestamp, uint256 accRewardsPerShare);
    event Harvested(address indexed user, address indexed token, uint256 amount);

    // Structs
    struct QueuedWithdrawal {
        mapping(address => uint256) userWithdrawals;
        uint256 totalQueuedShares;
        uint128 totalAmountX;
        uint128 totalAmountY;
    }

    struct Reward {
        IERC20 token;
        uint256 lastRewardBalance;
        uint256 accRewardsPerShare;
    }

    struct User {
        uint256 phantomAmount;
        mapping(address => uint256) rewardDebtPerToken;
    }

    struct UserInfo {
        uint256 phantomAmount;
        RewardDebtInfo[] rewardDebtInfo;
    }

    struct RewardDebtInfo {
        IERC20 token;
        uint256 rewardDebt;
    }

    struct UserReward {
        IERC20 token;
        uint256 pendingRewards;
    }

    // Core functions
    function initialize() external;
    function getFactory() external view returns (IVaultFactory);
    function getPool() external pure returns (IRamsesV3Pool);
    function getTokenX() external pure returns (IERC20Upgradeable);
    function getTokenY() external pure returns (IERC20Upgradeable);
    function getStrategy() external view returns (IShadowStrategy);
    function setStrategy(IShadowStrategy strategy) external;
    
    // Oracle functions
    function getOracleHelper() external pure returns (IOracleHelper);
    function getPrice() external view returns (uint256);
    function getOracleParameters() external view returns (IOracleHelper.OracleParameters memory);
    function checkPriceInDeviation() external view returns (bool);
    
    // Deposit/Withdraw functions
    function deposit(uint256 amountX, uint256 amountY) external returns (uint256);
    function depositNative(uint256 amountOther, bool isOtherTokenX) external payable returns (uint256);
    function queueWithdrawal(uint256 shares) external returns (uint256);
    function executeQueuedWithdrawals() external;
    function redeemQueuedWithdrawal(uint256 round) external returns (uint256, uint256);
    function redeemQueuedWithdrawalBatch(uint256[] calldata rounds) external returns (uint256, uint256);
    
    // Reward functions
    function getUserInfo(address user) external view returns (UserInfo memory);
    function getPendingRewards(address user) external view returns (UserReward[] memory);
    function claim() external;
    function notifyRewardToken(IERC20 token) external;
    function updateAccRewardsPerShare() external;
    
    // Emergency functions
    function emergencyMode() external;
    function pauseDeposits() external;
    function resumeDeposits() external;
    
    // View functions
    function areDepositsAllowed() external view returns (bool);
    function getQueuedWithdrawalRounds() external view returns (uint256);
    function getBalances() external view returns (uint256, uint256);
    function getIdleBalances() external view returns (uint256, uint256);
    function getRange() external view returns (int24, int24);
    function getOperators() external view returns (address, address);
}
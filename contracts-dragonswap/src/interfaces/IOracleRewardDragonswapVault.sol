// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IRamsesV3Pool} from "../../CL/core/interfaces/IRamsesV3Pool.sol";
import {IMinimalVault} from "../../../contracts-metropolis/src/interfaces/IMinimalVault.sol";
import {IStrategyCommon} from "../../../contracts-metropolis/src/interfaces/IStrategyCommon.sol";
import {IVaultFactory} from "../../../contracts-metropolis/src/interfaces/IVaultFactory.sol";
import {IERC20} from "../../../contracts-metropolis/src/interfaces/IHooksRewarder.sol";

/**
 * @title Oracle Reward Dragonswap Vault Interface
 * @author Arca
 * @notice Interface for Dragonswap vaults with oracle pricing and reward distribution
 */
interface IOracleRewardDragonswapVault is IMinimalVault, IERC20Upgradeable {
    // Errors
    error DragonswapVault__OnlyFactory();
    error DragonswapVault__OnlyOperators();
    error DragonswapVault__OnlyStrategy();
    error DragonswapVault__OnlyWNative();
    error DragonswapVault__DepositsPaused();
    error DragonswapVault__NoNativeToken();
    error DragonswapVault__InvalidRecipient();
    error DragonswapVault__ZeroShares();
    error DragonswapVault__ZeroAmount();
    error DragonswapVault__InvalidStrategy();
    error DragonswapVault__InvalidNativeAmount();
    error DragonswapVault__InsufficientShares();
    error DragonswapVault__InvalidRound();
    error DragonswapVault__NoQueuedWithdrawal();
    error DragonswapVault__Unauthorized();
    error DragonswapVault__InvalidToken();
    error DragonswapVault__BurnMinShares();
    error DragonswapVault__NativeTransferFailed();
    error DragonswapVault__NotInEmergencyMode();
    error DragonswapVault__SameStrategy();
    error DragonswapVault__MaxSharesExceeded();
    error DragonswapVault__AlreadyFlaggedForShutdown();
    error DragonswapVault__InvalidShares();
    error DragonswapVault__WithdrawLocked();

    // Events
    event Deposited(
        address indexed sender,
        uint256 amountX,
        uint256 amountY,
        uint256 shares
    );
    event WithdrawalQueued(
        address indexed sender,
        address indexed recipient,
        uint256 round,
        uint256 shares
    );
    event WithdrawalCancelled(
        address indexed sender,
        address indexed recipient,
        uint256 round,
        uint256 shares
    );
    event WithdrawalRedeemed(
        address indexed sender,
        address indexed recipient,
        uint256 round,
        uint256 shares,
        uint256 amountX,
        uint256 amountY
    );
    event WithdrawalExecuted(
        uint256 round,
        uint256 shares,
        uint256 amountX,
        uint256 amountY
    );
    event EmergencyWithdrawal(
        address indexed sender,
        uint256 shares,
        uint256 amountX,
        uint256 amountY
    );
    event StrategySet(address indexed strategy);
    event DepositsPaused();
    event DepositsResumed();
    event EmergencyMode();
    event Recovered(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    event ShutdownSubmitted();
    event ShutdownCancelled();
    event PoolUpdated(uint256 timestamp, uint256 accRewardsPerShare);
    event Harvested(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    // Structs
    struct QueuedWithdrawal {
        uint256 totalQueuedShares;
        uint128 totalAmountX;
        uint128 totalAmountY;
        mapping(address => uint256) userWithdrawals;
    }

    struct User {
        uint256 phantomAmount;
        mapping(address => uint256) rewardDebtPerToken;
    }

    struct Reward {
        IERC20 token;
        uint256 lastRewardBalance;
        uint256 accRewardsPerShare;
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

    // Initialization
    function initialize(string memory name, string memory symbol) external;

    // Version
    function version() external pure returns (uint8);

    // ERC20 overrides
    function decimals() external view returns (uint8);

    // Core view functions
    function getFactory() external view returns (IVaultFactory);
    function getVaultType() external pure returns (IVaultFactory.VaultType);
    function getPool() external pure returns (IRamsesV3Pool);
    function getTokenX() external pure returns (IERC20Upgradeable);
    function getTokenY() external pure returns (IERC20Upgradeable);
    function getStrategy() external view returns (IStrategyCommon);
    function getTwapInterval() external view returns (uint32);
    function setTwapInterval(uint32 twapInterval) external;
    function getAumAnnualFee() external view returns (uint256);
    function getOperators()
        external
        view
        returns (address defaultOperator, address operator);
    function getBalances()
        external
        view
        returns (uint256 amountX, uint256 amountY);
    function isDepositsPaused() external view returns (bool paused);
    function isFlaggedForShutdown() external view returns (bool);

    // Queue management view functions
    function getCurrentRound() external view returns (uint256 round);
    function getQueuedWithdrawal(
        uint256 round,
        address user
    ) external view returns (uint256 shares);
    function getTotalQueuedWithdrawal(
        uint256 round
    ) external view returns (uint256 totalQueuedShares);
    function getCurrentTotalQueuedWithdrawal()
        external
        view
        returns (uint256 totalQueuedShares);
    function getRedeemableAmounts(
        uint256 round,
        address user
    ) external view returns (uint256 amountX, uint256 amountY);

    // Preview functions
    function previewShares(
        uint256 amountX,
        uint256 amountY
    )
        external
        view
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY);
    function previewAmounts(
        uint256 shares
    ) external view returns (uint256 amountX, uint256 amountY);

    // Deposit functions
    function deposit(
        uint256 amountX,
        uint256 amountY,
        uint256 minShares
    ) external returns (uint256 shares, uint256 effectiveX, uint256 effectiveY);
    function depositNative(
        uint256 amountX,
        uint256 amountY,
        uint256 minShares
    )
        external
        payable
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY);

    // Withdrawal functions
    function queueWithdrawal(
        uint256 shares,
        address recipient
    ) external returns (uint256 round);
    function cancelQueuedWithdrawal(
        uint256 shares
    ) external returns (uint256 round);
    function redeemQueuedWithdrawal(
        uint256 round,
        address recipient
    ) external returns (uint256 amountX, uint256 amountY);
    function redeemQueuedWithdrawalNative(
        uint256 round,
        address recipient
    ) external returns (uint256 amountX, uint256 amountY);
    function emergencyWithdraw() external;
    function executeQueuedWithdrawals() external;

    // Reward functions
    function getUserInfo(
        address user
    ) external view returns (UserInfo memory userInfo);
    function getPendingRewards(
        address user
    ) external view returns (UserReward[] memory rewards);
    function claim() external;
    function notifyRewardToken(IERC20 token) external;
    function updateAccRewardsPerShare() external;

    /// @dev Register my contract on Sonic FeeM
    function registerMe() external;

    // Admin functions
    function setStrategy(IStrategyCommon newStrategy) external;
    function pauseDeposits() external;
    function resumeDeposits() external;
    function submitShutdown() external;
    function cancelShutdown() external;
    function setEmergencyMode() external;
    function recoverERC20(
        IERC20Upgradeable token,
        address recipient,
        uint256 amount
    ) external;
}

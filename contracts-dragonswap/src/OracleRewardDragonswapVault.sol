// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {Clone} from "@arca/joe-v2/libraries/Clone.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IRamsesV3Pool} from "../CL/core/interfaces/IRamsesV3Pool.sol";
import {Uint256x256Math} from "@arca/joe-v2/libraries/math/Uint256x256Math.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {SafeCast} from "@arca/joe-v2/libraries/math/SafeCast.sol";
import {IStrategyCommon} from "../../contracts-metropolis/src/interfaces/IStrategyCommon.sol";
import {IDragonswapStrategy} from "./interfaces/IDragonswapStrategy.sol";
import {IVaultFactory} from "../../contracts-metropolis/src/interfaces/IVaultFactory.sol";
import {IWNative} from "../../contracts-metropolis/src/interfaces/IWNative.sol";
import {IERC20} from "../../contracts-metropolis/src/interfaces/IHooksRewarder.sol";
import {TokenHelper} from "../../contracts-metropolis/src/libraries/TokenHelper.sol";
import {Precision} from "../../contracts-metropolis/src/libraries/Precision.sol";
import {Math} from "../../contracts-metropolis/src/libraries/Math.sol";
import {IOracleRewardDragonswapVault} from "./interfaces/IOracleRewardDragonswapVault.sol";
import {DragonswapPriceHelper} from "./libraries/DragonswapPriceHelper.sol";

/**
 * @title Oracle Reward Dragonswap Vault contract
 * @author Arca
 * @notice This contract is a standalone vault for Dragonswap (CL V2) pools with pool-based oracle pricing and reward distribution
 * @dev The immutable data should be encoded as follows:
 * - 0x00: 20 bytes: The address of the Dragonswap pool
 * - 0x14: 20 bytes: The address of token 0
 * - 0x28: 20 bytes: The address of token 1
 * - 0x3C: 1 byte: The decimals of token 0
 * - 0x3D: 1 byte: The decimals of token 1
 */
contract OracleRewardDragonswapVault is
    Clone,
    ERC20Upgradeable,
    ReentrancyGuardUpgradeable,
    IOracleRewardDragonswapVault
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using Uint256x256Math for uint256;
    using SafeCast for uint256;
    using Precision for uint256;
    using Math for uint256;

    // ============ Constants ============
    uint8 internal constant _SHARES_DECIMALS = 6;
    uint256 internal constant _SHARES_PRECISION = 10 ** _SHARES_DECIMALS;
    uint256 private constant PHANTOM_SHARE_PRECISION = 1e18;

    // ============ State Variables ============
    IVaultFactory internal immutable _factory;
    address private immutable _wnative;

    // Pool oracle configuration
    uint32 private _twapInterval; // 0 for spot price, >0 for TWAP

    IStrategyCommon private _strategy;
    bool private _depositsPaused;
    bool private _flaggedForShutdown;

    QueuedWithdrawal[] private _queuedWithdrawalsByRound;

    uint256 internal _totalAmountX;
    uint256 internal _totalAmountY;
    uint256 private _phantomShareSupply;

    mapping(address => User) private _users;
    mapping(address => uint256) private userDeposited;
    mapping(address => bool) private tokenCached;
    Reward[] private cachedRewardTokens;

    // ============ Modifiers ============
    modifier onlyFactory() {
        if (msg.sender != address(_factory)) revert DragonswapVault__OnlyFactory();
        _;
    }

    modifier onlyOperators() {
        if (address(getStrategy()) == address(0)) {
            if (msg.sender != _factory.getDefaultOperator()) {
                revert DragonswapVault__OnlyOperators();
            }
        } else if (
            msg.sender != getStrategy().getOperator() &&
            msg.sender != _factory.getDefaultOperator()
        ) {
            revert DragonswapVault__OnlyOperators();
        }
        _;
    }

    modifier depositsAllowed() {
        if (_depositsPaused) revert DragonswapVault__DepositsPaused();
        _;
    }

    modifier onlyVaultWithNativeToken() {
        if (address(_tokenX()) != _wnative && address(_tokenY()) != _wnative)
            revert DragonswapVault__NoNativeToken();
        _;
    }

    modifier onlyValidRecipient(address recipient) {
        if (recipient == address(0)) revert DragonswapVault__InvalidRecipient();
        _;
    }

    modifier NonZeroShares(uint256 shares) {
        if (shares == 0) revert DragonswapVault__ZeroShares();
        _;
    }

    modifier cooldownPassed(address sender) {
        if (
            userDeposited[sender] + _factory.getDepositToWithdrawCooldown() >
            block.timestamp
        ) revert DragonswapVault__WithdrawLocked();
        _;
    }

    // ============ Constructor ============
    constructor(IVaultFactory factory) {
        _factory = factory;
        _wnative = factory.getWNative();
    }

    /**
     * @dev Receive function. Mainly added to silence the compiler warning.
     * Highly unlikely to be used as the base vault needs at least 62 bytes of immutable data added to the payload
     * (3 addresses and 2 bytes for length), so this function should never be called.
     */
    receive() external payable {
        if (msg.sender != _wnative && msg.sender != address(getStrategy()))
            revert DragonswapVault__OnlyWNative();
    }

    /**
     * @notice Allows the contract to receive native tokens from the WNative contract.
     * @dev We can't use the `receive` function because the immutable clone library adds calldata to the payload
     * that are taken as a function signature and parameters.
     */
    fallback() external payable {
        if (msg.sender != _wnative && msg.sender != address(getStrategy()))
            revert DragonswapVault__OnlyWNative();
    }

    // ============ Initialization ============
    function initialize(
        string memory name,
        string memory symbol
    ) public virtual initializer {
        __ERC20_init(name, symbol);
        __ReentrancyGuard_init();

        // Initialize the first round of queued withdrawals
        _queuedWithdrawalsByRound.push();
    }

    /// @dev Register my contract on Sonic FeeM
    function registerMe() external {
        (bool _success, ) = address(0xDC2B0D2Dd2b7759D97D50db4eabDC36973110830) // solhint-disable-line avoid-low-level-calls
            .call(abi.encodeWithSignature("selfRegister(uint256)", 236));
        require(_success, "FeeM registration failed");
    }

    // ============ Public View Functions ============
    function version() external pure returns (uint8) {
        return 1;
    }

    function decimals()
        public
        view
        virtual
        override(ERC20Upgradeable, IOracleRewardDragonswapVault)
        returns (uint8)
    {
        return _decimalsY() + _SHARES_DECIMALS;
    }

    function getFactory() external view virtual returns (IVaultFactory) {
        return _factory;
    }

    /**
     * @dev Returns the type of the vault.
     * @return vaultType The type of the vault (DragonswapOracleReward)
     */
    function getVaultType()
        external
        pure
        virtual
        returns (IVaultFactory.VaultType)
    {
        return IVaultFactory.VaultType.DragonswapOracleReward;
    }

    function getPool() external pure virtual returns (IRamsesV3Pool) {
        return _pool();
    }

    function getTokenX() external pure virtual returns (IERC20Upgradeable) {
        return _tokenX();
    }

    function getTokenY() external pure virtual returns (IERC20Upgradeable) {
        return _tokenY();
    }

    function getStrategy() public view virtual returns (IStrategyCommon) {
        return _strategy;
    }

    function getTwapInterval() external view virtual returns (uint32) {
        return _twapInterval;
    }

    function setTwapInterval(uint32 twapInterval) external virtual {
        if (
            msg.sender != address(_factory) &&
            msg.sender != _factory.getDefaultOperator()
        ) {
            revert DragonswapVault__OnlyFactory();
        }
        _twapInterval = twapInterval;
    }

    function getAumAnnualFee() external view virtual returns (uint256) {
        IStrategyCommon strategy = _strategy;
        return address(strategy) == address(0) ? 0 : strategy.getAumAnnualFee();
    }

    function getOperators()
        external
        view
        virtual
        returns (address defaultOperator, address operator)
    {
        IStrategyCommon strategy = _strategy;
        defaultOperator = _factory.getDefaultOperator();
        operator = address(strategy) == address(0)
            ? address(0)
            : strategy.getOperator();
    }

    function getBalances()
        external
        view
        virtual
        returns (uint256 amountX, uint256 amountY)
    {
        (amountX, amountY) = _getBalances(_strategy);
    }

    /**
     * @notice Returns if the deposits are paused.
     * @return paused True if the deposits are paused.
     */
    function isDepositsPaused() external view virtual returns (bool paused) {
        return _depositsPaused;
    }

    function isFlaggedForShutdown() external view returns (bool) {
        return _flaggedForShutdown;
    }

    /**
     * @notice Returns the current round of queued withdrawals.
     * @return round The current round of queued withdrawals.
     */
    function getCurrentRound() external view virtual returns (uint256 round) {
        return _queuedWithdrawalsByRound.length - 1;
    }

    /**
     * @notice Returns the queued withdrawal of the round for an user.
     * @param round The round.
     * @param user The user.
     * @return shares The amount of shares that are queued for withdrawal.
     */
    function getQueuedWithdrawal(
        uint256 round,
        address user
    ) external view virtual returns (uint256 shares) {
        return _queuedWithdrawalsByRound[round].userWithdrawals[user];
    }

    /**
     * @notice Returns the total shares that were queued for the current round.
     * @return totalQueuedShares The total shares that were queued for the current round.
     */
    function getTotalQueuedWithdrawal(
        uint256 round
    ) external view virtual returns (uint256 totalQueuedShares) {
        return _queuedWithdrawalsByRound[round].totalQueuedShares;
    }

    function getCurrentTotalQueuedWithdrawal()
        public
        view
        virtual
        returns (uint256 totalQueuedShares)
    {
        return
            _queuedWithdrawalsByRound[_queuedWithdrawalsByRound.length - 1]
                .totalQueuedShares;
    }

    /**
     * @notice Returns the amounts that can be redeemed for an user on the round.
     * @param round The round.
     * @param user The user.
     * @return amountX The amount of token X that can be redeemed.
     * @return amountY The amount of token Y that can be redeemed.
     */
    function getRedeemableAmounts(
        uint256 round,
        address user
    ) public view virtual returns (uint256 amountX, uint256 amountY) {
        QueuedWithdrawal storage queuedWithdrawal = _queuedWithdrawalsByRound[
            round
        ];
        uint256 totalAmountX = queuedWithdrawal.totalAmountX;
        uint256 totalAmountY = queuedWithdrawal.totalAmountY;

        uint256 shares = queuedWithdrawal.userWithdrawals[user];
        uint256 totalShares = queuedWithdrawal.totalQueuedShares;

        if (totalShares > 0) {
            amountX = totalAmountX.mulDivRoundDown(shares, totalShares);
            amountY = totalAmountY.mulDivRoundDown(shares, totalShares);
        }
    }

    // ============ Reward Functions ============
    function getUserInfo(
        address user
    ) external view returns (UserInfo memory userInfo) {
        userInfo.phantomAmount = _users[user].phantomAmount;
        userInfo.rewardDebtInfo = new RewardDebtInfo[](
            cachedRewardTokens.length
        );
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            userInfo.rewardDebtInfo[i] = RewardDebtInfo({
                token: reward.token,
                rewardDebt: _users[user].rewardDebtPerToken[
                    address(reward.token)
                ]
            });
        }
        return userInfo;
    }

    function getPendingRewards(
        address user
    ) external view returns (UserReward[] memory rewards) {
        rewards = new UserReward[](cachedRewardTokens.length);
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            (uint256 calcAccRewardsPerShare, ) = _getAccRewardsPerShare(reward);
            rewards[i] = UserReward({
                token: reward.token,
                pendingRewards: _calcPending(
                    user,
                    reward,
                    calcAccRewardsPerShare
                )
            });
        }
    }

    // ============ Public Functions ============
    /**
     * @dev Preview the amount of shares to be minted.
     * @param amountX The amount of token X to be deposited.
     * @param amountY The amount of token Y to be deposited.
     * @return shares The amount of shares to be minted.
     * @return effectiveX The effective amount of token X to be deposited.
     * @return effectiveY The effective amount of token Y to be deposited.
     */
    function previewShares(
        uint256 amountX,
        uint256 amountY
    )
        public
        view
        virtual
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY)
    {
        return _previewShares(_strategy, amountX, amountY);
    }

    /**
     * @dev Preview the amount of tokens to be redeemed on withdrawal.
     * @param shares The amount of shares to be redeemed.
     * @return amountX The amount of token X to be redeemed.
     * @return amountY The amount of token Y to be redeemed.
     */
    function previewAmounts(
        uint256 shares
    ) public view virtual returns (uint256 amountX, uint256 amountY) {
        return _previewAmounts(_strategy, shares, totalSupply());
    }

    /**
     * @dev Deposits tokens to the strategy.
     * @param amountX The amount of token X to be deposited.
     * @param amountY The amount of token Y to be deposited.
     * @param minShares The minimum amount of shares to be minted.
     * @return shares The amount of shares to be minted.
     * @return effectiveX The effective amount of token X to be deposited.
     * @return effectiveY The effective amount of token Y to be deposited.
     */
    function deposit(
        uint256 amountX,
        uint256 amountY,
        uint256 minShares
    )
        public
        virtual
        nonReentrant
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY)
    {
        _updatePool();

        IStrategyCommon strategy;
        (strategy, shares, effectiveX, effectiveY) = _deposit(amountX, amountY);

        if (shares < minShares) revert DragonswapVault__InsufficientShares();

        _modifyUser(msg.sender, int256(shares));

        if (effectiveX > 0)
            _tokenX().safeTransferFrom(
                msg.sender,
                address(strategy),
                effectiveX
            );
        if (effectiveY > 0)
            _tokenY().safeTransferFrom(
                msg.sender,
                address(strategy),
                effectiveY
            );
    }

    function depositNative(
        uint256 amountX,
        uint256 amountY,
        uint256 minShares
    )
        public
        payable
        virtual
        nonReentrant
        onlyVaultWithNativeToken
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY)
    {
        (IERC20Upgradeable tokenX, IERC20Upgradeable tokenY) = (
            _tokenX(),
            _tokenY()
        );

        address wnative = _wnative;
        bool isNativeX = address(tokenX) == wnative;

        if (
            (isNativeX && amountX != msg.value) ||
            (!isNativeX && amountY != msg.value)
        ) {
            revert DragonswapVault__InvalidNativeAmount();
        }

        _updatePool();

        IStrategyCommon strategy;
        (strategy, shares, effectiveX, effectiveY) = _deposit(amountX, amountY);

        if (shares < minShares) revert DragonswapVault__InsufficientShares();

        _modifyUser(msg.sender, int256(shares));

        uint256 effectiveNative;
        if (isNativeX) {
            effectiveNative = effectiveX;
            if (effectiveY > 0)
                tokenY.safeTransferFrom(
                    msg.sender,
                    address(strategy),
                    effectiveY
                );
        } else {
            if (effectiveX > 0)
                tokenX.safeTransferFrom(
                    msg.sender,
                    address(strategy),
                    effectiveX
                );
            effectiveNative = effectiveY;
        }

        if (effectiveNative > 0) {
            IWNative(wnative).deposit{value: effectiveNative}();
            IERC20Upgradeable(wnative).safeTransfer(
                address(strategy),
                effectiveNative
            );
        }

        if (msg.value > effectiveNative) {
            unchecked {
                _transferNative(msg.sender, msg.value - effectiveNative);
            }
        }
    }

    /**
     * @notice Queues withdrawal for `recipient`. The withdrawal will be effective after the next
     * rebalance. The user can withdraw the tokens after the rebalance, this allows users to withdraw
     * from positions without having to pay the gas price.
     * @param shares The shares to be queued for withdrawal.
     * @param recipient The address that will receive the withdrawn tokens after the rebalance.
     * @return round The round of the withdrawal.
     */
    function queueWithdrawal(
        uint256 shares,
        address recipient
    )
        public
        virtual
        nonReentrant
        onlyValidRecipient(recipient)
        NonZeroShares(shares)
        cooldownPassed(msg.sender)
        returns (uint256 round)
    {
        address strategy = address(_strategy);
        if (strategy == address(0)) revert DragonswapVault__InvalidStrategy();

        _updatePool();

        _transfer(msg.sender, strategy, shares);

        round = _queuedWithdrawalsByRound.length - 1;
        QueuedWithdrawal storage queuedWithdrawals = _queuedWithdrawalsByRound[
            round
        ];

        queuedWithdrawals.totalQueuedShares += shares;
        unchecked {
            queuedWithdrawals.userWithdrawals[recipient] += shares;
        }

        emit WithdrawalQueued(msg.sender, recipient, round, shares);
    }

    /**
     * @notice Cancels a queued withdrawal of `shares`. Cancelling a withdrawal is
     * only possible before the next rebalance. The user can cancel the withdrawal if they want to
     * stay in the vault. They will receive the vault shares back.
     * @param shares The shares to be cancelled for withdrawal.
     * @return round The round of the withdrawal that was cancelled.
     */
    function cancelQueuedWithdrawal(
        uint256 shares
    )
        public
        virtual
        nonReentrant
        NonZeroShares(shares)
        returns (uint256 round)
    {
        address strategy = address(_strategy);
        if (strategy == address(0)) revert DragonswapVault__InvalidStrategy();

        _updatePool();

        round = _queuedWithdrawalsByRound.length - 1;
        QueuedWithdrawal storage queuedWithdrawals = _queuedWithdrawalsByRound[
            round
        ];

        uint256 maxShares = queuedWithdrawals.userWithdrawals[msg.sender];
        if (shares > maxShares) revert DragonswapVault__MaxSharesExceeded();

        unchecked {
            queuedWithdrawals.userWithdrawals[msg.sender] = maxShares - shares;
            queuedWithdrawals.totalQueuedShares -= shares;
        }

        _transfer(strategy, msg.sender, shares);

        emit WithdrawalCancelled(msg.sender, msg.sender, round, shares);
    }

    /**
     * @notice Redeems a queued withdrawal for `recipient`. The user can redeem the tokens after the
     * rebalance. This can be easily check by comparing the current round with the round of the
     * withdrawal, if they're equal, the withdrawal is still pending.
     * @param recipient The address that will receive the withdrawn tokens after the rebalance.
     * @return amountX The amount of token X to be withdrawn.
     * @return amountY The amount of token Y to be withdrawn.
     */
    function redeemQueuedWithdrawal(
        uint256 round,
        address recipient
    )
        public
        virtual
        nonReentrant
        onlyValidRecipient(recipient)
        returns (uint256 amountX, uint256 amountY)
    {
        (amountX, amountY) = _redeemWithdrawal(round, recipient);

        if (amountX > 0) _tokenX().safeTransfer(recipient, amountX);
        if (amountY > 0) _tokenY().safeTransfer(recipient, amountY);
    }

    function redeemQueuedWithdrawalNative(
        uint256 round,
        address recipient
    )
        public
        virtual
        nonReentrant
        onlyVaultWithNativeToken
        onlyValidRecipient(recipient)
        returns (uint256 amountX, uint256 amountY)
    {
        (amountX, amountY) = _redeemWithdrawal(round, recipient);

        if (amountX > 0) _transferTokenOrNative(_tokenX(), recipient, amountX);
        if (amountY > 0) _transferTokenOrNative(_tokenY(), recipient, amountY);
    }

    /**
     * @dev Claim rewards of the sender.
     */
    function claim() external nonReentrant {
        _updatePool();
        _modifyUser(msg.sender, 0);
    }

    /**
     * @notice Emergency withdraws from the vault and sends the tokens to the sender according to its share.
     * If the user had queued withdrawals, they will be claimable using the `redeemQueuedWithdrawal` and
     * `redeemQueuedWithdrawalNative` functions as usual. This function is only for users that didn't queue
     * any withdrawals and still have shares in the vault. We skip reward payout as its emergency mode.
     * @dev This will only work if the vault is in emergency mode or flagged for shutdown
     */
    function emergencyWithdraw() public virtual nonReentrant {
        if (address(_strategy) != address(0))
            revert DragonswapVault__NotInEmergencyMode();

        uint256 shares = balanceOf(msg.sender);
        if (shares == 0) revert DragonswapVault__ZeroShares();

        (uint256 balanceX, uint256 balanceY) = _getBalances(
            IStrategyCommon(address(0))
        );
        uint256 totalShares = totalSupply();

        uint256 amountX = balanceX.mulDivRoundDown(shares, totalShares);
        uint256 amountY = balanceY.mulDivRoundDown(shares, totalShares);

        _burn(msg.sender, shares);

        if (amountX > 0) _tokenX().safeTransfer(msg.sender, amountX);
        if (amountY > 0) _tokenY().safeTransfer(msg.sender, amountY);

        emit EmergencyWithdrawal(msg.sender, shares, amountX, amountY);
    }

    /**
     * @notice Executes the queued withdrawals for the current round. The strategy should call this
     * function after having sent the queued withdrawals to the vault.
     * This function will burn the shares of the users that queued withdrawals and will update the
     * total amount of tokens in the vault and increase the round.
     * @dev Only the strategy can call this function.
     */
    function executeQueuedWithdrawals() public virtual nonReentrant {
        // Check that the caller is the strategy, it also checks that the strategy was set.
        address strategy = address(_strategy);
        if (strategy != msg.sender) revert DragonswapVault__OnlyStrategy();

        // Get the current round and the queued withdrawals for that round.
        uint256 round = _queuedWithdrawalsByRound.length - 1;
        QueuedWithdrawal storage queuedWithdrawals = _queuedWithdrawalsByRound[
            round
        ];

        // Check that the round has queued withdrawals, if none, the function will stop.
        uint256 totalQueuedShares = queuedWithdrawals.totalQueuedShares;
        if (totalQueuedShares == 0) return;

        // Burn the shares of the users that queued withdrawals and update the queued withdrawals.
        _burn(strategy, totalQueuedShares);
        _queuedWithdrawalsByRound.push();

        // Cache the total amounts of tokens in the vault.
        uint256 totalAmountX = _totalAmountX;
        uint256 totalAmountY = _totalAmountY;

        // Get the amount of tokens received by the vault after executing the withdrawals.
        uint256 receivedX = _tokenX().balanceOf(address(this)) -
            totalAmountX -
            _rewardX();
        uint256 receivedY = _tokenY().balanceOf(address(this)) -
            totalAmountY -
            _rewardY();

        // Update the total amounts of tokens in the vault.
        _totalAmountX = totalAmountX + receivedX;
        _totalAmountY = totalAmountY + receivedY;

        // Update the total amounts of tokens in the queued withdrawals.
        queuedWithdrawals.totalAmountX = uint128(receivedX);
        queuedWithdrawals.totalAmountY = uint128(receivedY);

        emit WithdrawalExecuted(round, totalQueuedShares, receivedX, receivedY);
    }

    // ============ Admin Functions ============
    function setStrategy(
        IStrategyCommon newStrategy
    ) public virtual onlyFactory {
        IStrategyCommon currentStrategy = _strategy;

        if (currentStrategy == newStrategy) revert DragonswapVault__SameStrategy();

        if (
            newStrategy.getStrategyType() != IVaultFactory.StrategyType.Dragonswap
        ) {
            revert DragonswapVault__InvalidStrategy();
        }

        if (
            newStrategy.getVault() != address(this) ||
            IDragonswapStrategy(address(newStrategy)).getPool() !=
                address(_pool()) ||
            newStrategy.getTokenX() != _tokenX() ||
            newStrategy.getTokenY() != _tokenY()
        ) revert DragonswapVault__InvalidStrategy();

        if (address(currentStrategy) != address(0)) {
            currentStrategy.withdrawAll();
        }

        (uint256 balanceX, uint256 balanceY) = _getBalances(
            IStrategyCommon(address(0))
        );

        if (balanceX > 0)
            _tokenX().safeTransfer(address(newStrategy), balanceX);
        if (balanceY > 0)
            _tokenY().safeTransfer(address(newStrategy), balanceY);

        _setStrategy(newStrategy);
    }

    function pauseDeposits() public virtual onlyOperators nonReentrant {
        _depositsPaused = true;
        emit DepositsPaused();
    }

    function resumeDeposits() public virtual onlyOperators nonReentrant {
        _depositsPaused = false;
        emit DepositsResumed();
    }

    function submitShutdown() external onlyOperators {
        if (_flaggedForShutdown)
            revert DragonswapVault__AlreadyFlaggedForShutdown();
        _flaggedForShutdown = true;
        emit ShutdownSubmitted();
    }

    function cancelShutdown() external onlyFactory {
        _flaggedForShutdown = false;
        emit ShutdownCancelled();
    }

    function setEmergencyMode() public virtual onlyFactory {
        _strategy.withdrawAll();
        _beforeEmergencyMode();
        _setStrategy(IStrategyCommon(address(0)));
        emit EmergencyMode();
    }

    function recoverERC20(
        IERC20Upgradeable token,
        address recipient,
        uint256 amount
    ) public virtual nonReentrant onlyFactory {
        address strategy = address(_strategy);

        if (
            token == _tokenX() &&
            (strategy == address(0) ||
                token.balanceOf(address(this)) <
                    _totalAmountX + amount + _rewardX())
        ) {
            revert DragonswapVault__InvalidToken();
        }

        if (
            token == _tokenY() &&
            (strategy == address(0) ||
                token.balanceOf(address(this)) <
                    _totalAmountY + amount + _rewardY())
        ) {
            revert DragonswapVault__InvalidToken();
        }

        if (token == this) {
            uint256 excessStrategy = balanceOf(strategy) -
                getCurrentTotalQueuedWithdrawal();

            if (
                balanceOf(address(this)) + excessStrategy <
                amount + _SHARES_PRECISION
            ) {
                revert DragonswapVault__BurnMinShares();
            }

            if (excessStrategy > 0) {
                _transfer(strategy, address(this), excessStrategy);
                _modifyUser(address(this), int256(excessStrategy));
            }
        }

        token.safeTransfer(recipient, amount);

        if (
            strategy == address(0) &&
            (_tokenX().balanceOf(address(this)) < _totalAmountX + _rewardX() ||
                _tokenY().balanceOf(address(this)) < _totalAmountY + _rewardY())
        ) {
            revert DragonswapVault__InvalidToken();
        }

        emit Recovered(address(token), recipient, amount);
    }

    // ============ Reward Management ============
    function notifyRewardToken(IERC20 token) external {
        if (address(getStrategy()) != msg.sender)
            revert DragonswapVault__OnlyStrategy();
        _notifyRewardToken(token);
    }

    function updateAccRewardsPerShare() public {
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            (
                uint256 accRewardsPerShare,
                uint256 rewardBalance
            ) = _getAccRewardsPerShare(reward);

            reward.accRewardsPerShare = accRewardsPerShare;
            reward.lastRewardBalance = rewardBalance;
            emit PoolUpdated(block.timestamp, accRewardsPerShare);
        }
    }

    // ============ Internal Functions ============
    function _pool() internal pure virtual returns (IRamsesV3Pool) {
        return IRamsesV3Pool(_getArgAddress(0));
    }

    function _tokenX() internal pure virtual returns (IERC20Upgradeable) {
        return IERC20Upgradeable(_getArgAddress(20));
    }

    function _tokenY() internal pure virtual returns (IERC20Upgradeable) {
        return IERC20Upgradeable(_getArgAddress(40));
    }

    function _decimalsX() internal pure virtual returns (uint8) {
        return _getArgUint8(60);
    }

    function _decimalsY() internal pure virtual returns (uint8) {
        return _getArgUint8(61);
    }

    function _previewShares(
        IStrategyCommon strategy,
        uint256 amountX,
        uint256 amountY
    )
        internal
        view
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY)
    {
        if (amountX == 0 && amountY == 0) return (0, 0, 0);

        uint256 amountXinY = _calculateAmountInOtherToken(amountX, true);

        uint256 totalShares = totalSupply();

        uint256 valueInY = amountXinY + amountY;

        if (totalShares == 0) {
            return (valueInY * _SHARES_PRECISION, amountX, amountY);
        }

        (uint256 totalX, uint256 totalY) = _getBalances(strategy);

        if (totalX == 0 && totalY == 0) {
            revert DragonswapVault__ZeroAmount();
        }

        uint256 totalXinY = _calculateAmountInOtherToken(totalX, true);
        uint256 totalValueInY = totalXinY + totalY;
        shares = valueInY.mulDivRoundDown(totalShares, totalValueInY);

        return (shares, amountX, amountY);
    }

    function _previewAmounts(
        IStrategyCommon strategy,
        uint256 shares,
        uint256 totalShares
    ) internal view virtual returns (uint256 amountX, uint256 amountY) {
        if (shares == 0) return (0, 0);
        if (shares > totalShares) revert DragonswapVault__InvalidShares();

        (uint256 totalX, uint256 totalY) = _getBalances(strategy);

        amountX = totalX.mulDivRoundDown(shares, totalShares);
        amountY = totalY.mulDivRoundDown(shares, totalShares);
    }

    function _calculateAmountInOtherToken(
        uint256 amount,
        bool isTokenX
    ) internal view returns (uint256) {
        uint256 priceXInY = _getOraclePrice(true);
        if (isTokenX) {
            // Converting X to Y: multiply by price of X in Y
            return amount.mulDivRoundDown(priceXInY, 10 ** _decimalsX());
        } else {
            // Converting Y to X: divide by price of X in Y
            return amount.mulDivRoundDown(10 ** _decimalsX(), priceXInY);
        }
    }

    function _getOraclePrice(bool isTokenX) internal view returns (uint256) {
        return
            DragonswapPriceHelper.getOraclePrice(
                _pool(),
                isTokenX,
                _twapInterval,
                _decimalsX(),
                _decimalsY()
            );
    }

    /**
     * @dev Calculates total value in TokenY terms (following Metropolis pattern)
     * @param amountX Amount of tokenX
     * @param amountY Amount of tokenY
     * @return valueInY Total value expressed in tokenY's smallest units
     */
    function _getValueInY(
        uint256 amountX,
        uint256 amountY
    ) internal view returns (uint256 valueInY) {
        // Get price of X in terms of Y (with decimal adjustment)
        uint256 priceXInY = _getOraclePrice(true);

        // Convert X to Y value: (amountX * priceXInY) / 10^decimalsX
        // This gives us value in tokenY's decimal scale
        uint256 amountXInY = amountX.mulDivRoundDown(
            priceXInY,
            10 ** _decimalsX()
        );

        // Total value = X value in Y + Y amount
        valueInY = amountXInY + amountY;
    }

    function _getBalances(
        IStrategyCommon strategy
    ) internal view virtual returns (uint256 amountX, uint256 amountY) {
        return
            address(strategy) == address(0)
                ? (
                    _tokenX().balanceOf(address(this)) -
                        _totalAmountX -
                        _rewardX(),
                    _tokenY().balanceOf(address(this)) -
                        _totalAmountY -
                        _rewardY()
                )
                : strategy.getBalances();
    }

    function _setStrategy(IStrategyCommon strategy) internal virtual {
        _strategy = strategy;
        emit StrategySet(address(strategy));
    }

    function _deposit(
        uint256 amountX,
        uint256 amountY
    )
        internal
        virtual
        depositsAllowed
        returns (
            IStrategyCommon strategy,
            uint256 shares,
            uint256 effectiveX,
            uint256 effectiveY
        )
    {
        if (amountX == 0 && amountY == 0) revert DragonswapVault__ZeroAmount();

        strategy = _strategy;
        if (address(strategy) == address(0))
            revert DragonswapVault__InvalidStrategy();

        (shares, effectiveX, effectiveY) = _previewShares(
            strategy,
            amountX,
            amountY
        );

        if (shares == 0) revert DragonswapVault__ZeroShares();

        userDeposited[msg.sender] = block.timestamp;

        if (totalSupply() == 0) {
            // Avoid exploit when very little shares, min of total shares will always be _SHARES_PRECISION (1e6)
            shares -= _SHARES_PRECISION;
            _mint(address(this), _SHARES_PRECISION);
        }

        // Mint the shares
        _mint(msg.sender, shares);

        emit Deposited(msg.sender, effectiveX, effectiveY, shares);
    }

    /**
     * @dev Redeems the queued withdrawal for a given round and a given user.
     * Does not transfer the tokens to the user.
     * @param user The address of the user.
     * @return amountX The amount of token X to be withdrawn.
     * @return amountY The amount of token Y to be withdrawn.
     */
    function _redeemWithdrawal(
        uint256 round,
        address user
    ) internal returns (uint256 amountX, uint256 amountY) {
        // Prevent redeeming withdrawals for the current round that have not been executed yet
        uint256 currentRound = _queuedWithdrawalsByRound.length - 1;
        if (round >= currentRound) revert DragonswapVault__InvalidRound();

        QueuedWithdrawal storage queuedWithdrawals = _queuedWithdrawalsByRound[
            round
        ];

        // Get the amount of shares to redeem, will revert if the user has no queued withdrawal
        uint256 shares = queuedWithdrawals.userWithdrawals[user];
        if (shares == 0) revert DragonswapVault__NoQueuedWithdrawal();

        // Only the user can redeem their withdrawal. The factory is also allowed as it batches withdrawals for users
        if (user != msg.sender && msg.sender != address(_factory))
            revert DragonswapVault__Unauthorized();

        _updatePool();
        _modifyUser(msg.sender, -int256(shares));

        // Calculate the amount of tokens to be withdrawn, pro rata to the amount of shares
        uint256 totalQueuedShares = queuedWithdrawals.totalQueuedShares;
        queuedWithdrawals.userWithdrawals[user] = 0;

        amountX = uint256(queuedWithdrawals.totalAmountX).mulDivRoundDown(
            shares,
            totalQueuedShares
        );
        amountY = uint256(queuedWithdrawals.totalAmountY).mulDivRoundDown(
            shares,
            totalQueuedShares
        );

        if (amountX == 0 && amountY == 0) revert DragonswapVault__ZeroAmount();

        // Update the total amount of shares queued for withdrawal
        if (amountX != 0) _totalAmountX -= amountX;
        if (amountY != 0) _totalAmountY -= amountY;

        emit WithdrawalRedeemed(
            msg.sender,
            user,
            round,
            shares,
            amountX,
            amountY
        );
    }

    function _transferTokenOrNative(
        IERC20Upgradeable token,
        address recipient,
        uint256 amount
    ) internal {
        address wnative = _wnative;
        if (address(token) == wnative) {
            IWNative(wnative).withdraw(amount);
            _transferNative(recipient, amount);
        } else {
            token.safeTransfer(recipient, amount);
        }
    }

    function _transferNative(
        address recipient,
        uint256 amount
    ) internal virtual {
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert DragonswapVault__NativeTransferFailed();
    }

    // ============ Reward Internal Functions ============
    function _notifyRewardToken(IERC20 token) internal {
        if (!tokenCached[address(token)]) {
            tokenCached[address(token)] = true;
            cachedRewardTokens.push(
                Reward({
                    token: token,
                    lastRewardBalance: 0,
                    accRewardsPerShare: 0
                })
            );
        }
    }

    function _getAccRewardsPerShare(
        Reward storage reward
    )
        internal
        view
        returns (uint256 calcAccRewardsPerShare, uint256 rewardBalance)
    {
        if (address(getStrategy()) == address(0)) {
            return (reward.accRewardsPerShare, reward.lastRewardBalance);
        }

        rewardBalance = TokenHelper.safeBalanceOf(reward.token, address(this));
        if (reward.token == IERC20(address(_tokenX()))) {
            rewardBalance -= _totalAmountX;
        } else if (reward.token == IERC20(address(_tokenY()))) {
            rewardBalance -= _totalAmountY;
        }

        uint256 lastRewardBalance = reward.lastRewardBalance;
        calcAccRewardsPerShare = reward.accRewardsPerShare;

        // recompute accRewardsPerShare if not up to date
        if (
            reward.lastRewardBalance != rewardBalance && _phantomShareSupply > 0
        ) {
            uint256 accruedReward = rewardBalance > lastRewardBalance
                ? rewardBalance - lastRewardBalance
                : 0;

            if (accruedReward > 0) {
                calcAccRewardsPerShare =
                    calcAccRewardsPerShare +
                    ((accruedReward.shiftPrecision()) / _phantomShareSupply);
            }
        }
    }

    function _calcPending(
        address user,
        Reward storage reward,
        uint256 calcAccRewardsPerShare
    ) internal view returns (uint256) {
        return
            _users[user].phantomAmount > 0
                ? (_users[user].phantomAmount * calcAccRewardsPerShare)
                    .unshiftPrecision() -
                    _users[user].rewardDebtPerToken[address(reward.token)]
                : 0;
    }

    function _harvest(
        address user,
        Reward storage reward
    ) internal returns (uint256 payoutAmount) {
        payoutAmount = _calcPending(user, reward, reward.accRewardsPerShare);
        reward.lastRewardBalance = reward.lastRewardBalance - payoutAmount;

        emit Harvested(user, address(reward.token), payoutAmount);
    }

    function _updatePool() internal virtual {
        if (address(getStrategy()) != address(0)) {
            // Get all reward tokens
            try getStrategy().getRewardTokens() returns (
                address[] memory tokens
            ) {
                // Notify vault about all tokens
                for (uint256 i = 0; i < tokens.length; i++) {
                    if (tokens[i] != address(0)) {
                        _notifyRewardToken(IERC20(tokens[i]));
                    }
                }
            } catch {
                // Strategy doesn't support getRewardTokens() or external call failed
                // Continue without notifying tokens
            }
            // Harvest rewards
            try getStrategy().harvestRewards() {} catch {}
        }
        updateAccRewardsPerShare();
    }

    function _modifyUser(address user, int256 amount) internal virtual {
        User storage userData = _users[user];
        uint256 uAmount = uint256(amount < 0 ? -amount : amount);
        uint256 phantomAmount = (uAmount * PHANTOM_SHARE_PRECISION) /
            (10 ** decimals());

        // Calculate pending rewards and update state
        uint256[] memory payoutAmounts = new uint256[](
            cachedRewardTokens.length
        );
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            payoutAmounts[i] = _harvest(user, reward);
        }

        if (amount != 0) {
            userData.phantomAmount = amount > 0
                ? userData.phantomAmount + phantomAmount
                : userData.phantomAmount - phantomAmount;

            _phantomShareSupply = amount > 0
                ? _phantomShareSupply + phantomAmount
                : _phantomShareSupply - phantomAmount;
        }

        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            userData.rewardDebtPerToken[address(reward.token)] = (userData
                .phantomAmount * reward.accRewardsPerShare).unshiftPrecision();
        }

        // Transfer rewards
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            if (payoutAmounts[i] > 0) {
                TokenHelper.safeTransfer(
                    cachedRewardTokens[i].token,
                    user,
                    payoutAmounts[i]
                );
            }
        }
    }

    function _rewardX() internal view virtual returns (uint256) {
        uint256 rewardX = 0;
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            if (address(reward.token) == address(_tokenX())) {
                rewardX += reward.lastRewardBalance;
            }
        }
        return rewardX;
    }

    function _rewardY() internal view virtual returns (uint256) {
        uint256 rewardY = 0;
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            if (address(reward.token) == address(_tokenY())) {
                rewardY += reward.lastRewardBalance;
            }
        }
        return rewardY;
    }

    function _beforeEmergencyMode() internal virtual {
        // Can be overridden by inheriting contracts
    }

    /**
     * @dev claim rewards of sender before transfering it to recipient
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        if (!_isIgnored(recipient) || !_isIgnored(sender)) _updatePool();

        // we dont want to modify if the transfer is between user and strategy and vice versa
        // otherwise the accounting will be wrong as we modify the shares on redeem
        if (
            sender == address(getStrategy()) ||
            recipient == address(getStrategy())
        ) {
            super._transfer(sender, recipient, amount);
            return;
        }

        if (!_isIgnored(recipient)) _modifyUser(recipient, int256(amount));
        if (!_isIgnored(sender)) _modifyUser(sender, -int256(amount));

        super._transfer(sender, recipient, amount);
    }

    /**
     * Check if address is ignored for rewards (e.g strategy, or other addresses)
     * @param _address address
     */
    function _isIgnored(address _address) internal view returns (bool) {
        if (_address == address(getStrategy())) {
            return true;
        }
        return _factory.isTransferIgnored(_address);
    }
}

// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {Clone} from "@arca/joe-v2/libraries/Clone.sol";
import {
    IERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {
    SafeERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeCast} from "@arca/joe-v2/libraries/math/SafeCast.sol";
import {IERC20} from "@arca/joe-v2/interfaces/ILBPair.sol";

import {
    IVaultFactory
} from "../../contracts-metropolis/src/interfaces/IVaultFactory.sol";
import {IShadowStrategy} from "./interfaces/IShadowStrategy.sol";
import {
    INonfungiblePositionManager
} from "../CL/periphery/interfaces/INonfungiblePositionManager.sol";
import {IRamsesV3Pool} from "../CL/core/interfaces/IRamsesV3Pool.sol";
import {IMinimalGauge} from "./interfaces/IMinimalGauge.sol";
import {IMinimalVoter} from "./interfaces/IMinimalVoter.sol";
import {LiquidityAmounts} from "../CL/periphery/libraries/LiquidityAmounts.sol";
import {TickMath} from "../CL/core/libraries/TickMath.sol";
import {
    IOracleRewardVault
} from "../../contracts-metropolis/src/interfaces/IOracleRewardVault.sol";
import {Math} from "../../contracts-metropolis/src/libraries/Math.sol";
import {
    IOracleRewardShadowVault
} from "./interfaces/IOracleRewardShadowVault.sol";
import {Uint256x256Math} from "@arca/joe-v2/libraries/math/Uint256x256Math.sol";

/**
 * @title Shadow Strategy Contract
 * @author Arca
 * @notice Strategy for managing Shadow (Ramses V3) concentrated liquidity positions
 * @dev Standalone implementation that doesn't inherit from Metropolis Strategy
 *
 * The immutable data should be encoded as follows:
 * - 0x00: 20 bytes: The address of the Vault
 * - 0x14: 20 bytes: The address of the Ramses V3 Pool
 * - 0x28: 20 bytes: The address of token X
 * - 0x3C: 20 bytes: The address of token Y
 */
contract ShadowStrategy is Clone, ReentrancyGuardUpgradeable, IShadowStrategy {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeCast for uint256;
    using Math for uint256;
    using Uint256x256Math for uint256;

    // Additional errors not in IStrategyCommon but needed for Shadow
    error Strategy__ActiveIdSlippage();

    // Reward discovery and claiming events
    event RewardTokensDiscovered(address[] tokens);
    event RewardEarned(address indexed token, uint256 amount);
    event RewardClaimed(address indexed token, uint256 amount);
    event RewardForwarded(
        address indexed token,
        address indexed vault,
        uint256 amount
    );

    // Error events for monitoring
    event RewardDiscoveryFailed(address gauge);
    event RewardClaimFailed(address[] tokens);
    event XShadowConversionFailed();
    event VaultAccountingUpdateFailed(address vault);
    // Detailed rebalance debugging events
    event RebalanceStarted(
        address indexed operator,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountX,
        uint256 amountY
    );

    event RebalanceCheckFailed(string reason, uint256 timestamp);

    event RebalanceStepFailed(uint8 step, string reason);

    event RebalanceStepSuccess(uint8 step, bytes32 data);

    event TickValidationFailed(string reason, int24 value1, int24 value2);

    event SlippageCheckFailed(
        int24 currentTick,
        int24 desiredTick,
        int24 slippageTick
    );

    event InsufficientBalance(
        uint256 requestedX,
        uint256 requestedY,
        uint256 availableX,
        uint256 availableY
    );

    event RebalanceCompleted(
        uint256 newTokenId,
        uint256 depositedX,
        uint256 depositedY
    );

    event RebalanceAborted(string reason, uint8 step);
    event NftBurnFailure(uint256 tokenId);

    // Enhanced error events for better debugging
    event PositionExitFailed(uint256 tokenId, string reason);
    event WithdrawalProcessingFailed(uint256 queuedShares, string reason);
    event RewardHarvestFailed(address gauge, string reason);

    // events for exit position
    event LiquidityDecreased(uint256 indexed tokenId, uint128 liquidity);
    event LiquidityDecreaseFailed(uint256 indexed tokenId, string reason);
    event TokensCollected(
        uint256 indexed tokenId,
        uint256 amount0,
        uint256 amount1
    );
    event CollectFailed(uint256 indexed tokenId, string reason);
    event AdditionalTokensCollected(
        uint256 indexed tokenId,
        uint256 amount0,
        uint256 amount1
    );
    event PositionNotReadyForBurn(
        uint256 indexed tokenId,
        uint128 liquidity,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );

    // Structure to reduce stack variables
    struct RebalanceParams {
        int24 tickLower;
        int24 tickUpper;
        int24 desiredTick;
        int24 slippageTick;
        uint256 amountX;
        uint256 amountY;
    }

    uint256 private constant _PRECISION = 1e18;
    uint256 private constant _BASIS_POINTS = 1e4;
    uint256 private constant _MAX_AUM_ANNUAL_FEE = 0.3e4; // 30%
    uint256 private constant _SCALED_YEAR = 365 days * _BASIS_POINTS;
    uint256 private constant _SCALED_YEAR_SUB_ONE = _SCALED_YEAR - 1;

    IVaultFactory private immutable _factory;
    uint256 private immutable _MAX_RANGE;

    // Position tracking state
    uint256 private _positionTokenId; // 0 means no position
    int24 private _currentTickLower;
    int24 private _currentTickUpper;

    // Fee management
    uint16 private _aumAnnualFee;
    uint64 private _lastRebalance;
    uint16 private _pendingAumAnnualFee;
    bool private _pendingAumAnnualFeeSet;

    // Operational state
    uint256 private _rebalanceCoolDown;
    address private _operator;

    /**
     * @notice Modifier to check if the caller is the factory.
     */
    modifier onlyFactory() {
        if (msg.sender != address(_factory)) revert Strategy__OnlyFactory();
        _;
    }

    /**
     * @notice Modifier to check if the caller is the vault.
     */
    modifier onlyVault() {
        if (msg.sender != _vault()) revert Strategy__OnlyVault();
        _;
    }

    /**
     * @notice Modifier to check if the caller is the operator or the default operator.
     */
    modifier onlyOperators() {
        if (
            msg.sender != _operator &&
            msg.sender != _factory.getDefaultOperator()
        ) revert Strategy__OnlyOperators();
        _;
    }

    modifier onlyTrusted() {
        if (
            msg.sender != _operator &&
            msg.sender != _factory.getDefaultOperator() &&
            msg.sender != address(this) &&
            msg.sender != _vault()
        ) revert Strategy__OnlyTrusted();
        _;
    }

    modifier onlyDefaultOperator() {
        if (msg.sender != _factory.getDefaultOperator())
            revert Strategy__OnlyDefaultOperator();
        _;
    }

    /**
     * @dev Constructor of the contract.
     * @param factory The address of the factory.
     * @param maxRange The max range of the strategy (in ticks, not bins).
     */
    constructor(IVaultFactory factory, uint256 maxRange) {
        _disableInitializers();
        _factory = factory;
        _MAX_RANGE = maxRange;
    }

    receive() external payable {}
    fallback() external payable {}

    /**
     * @notice Initialize the contract.
     */
    function initialize() external initializer {
        __ReentrancyGuard_init();
        _rebalanceCoolDown = 5 seconds;
    }

    // ============ Immutable Data Getters ============

    /**
     * @dev Returns the address of the vault.
     * @return vault The address of the vault.
     */
    function _vault() internal pure returns (address vault) {
        vault = _getArgAddress(0);
    }

    /**
     * @dev Returns the address of the pool.
     * @return pool The address of the pool.
     */
    function _pool() internal pure returns (IRamsesV3Pool pool) {
        pool = IRamsesV3Pool(_getArgAddress(20));
    }

    /**
     * @dev Returns the address of the token X.
     * @return tokenX The address of the token X.
     */
    function _tokenX() internal pure returns (IERC20Upgradeable tokenX) {
        tokenX = IERC20Upgradeable(_getArgAddress(40));
    }

    /**
     * @dev Returns the address of the token Y.
     * @return tokenY The address of the token Y.
     */
    function _tokenY() internal pure returns (IERC20Upgradeable tokenY) {
        tokenY = IERC20Upgradeable(_getArgAddress(60));
    }

    // ============ IStrategyCommon Implementation ============

    function getFactory() external view returns (IVaultFactory) {
        return _factory;
    }

    function getVault() external pure returns (address) {
        return _vault();
    }

    function getPool() external pure returns (address) {
        return address(_pool());
    }

    function getTokenX() external pure returns (IERC20Upgradeable) {
        return _tokenX();
    }

    function getTokenY() external pure returns (IERC20Upgradeable) {
        return _tokenY();
    }

    function getOperator() external view returns (address) {
        return _operator;
    }

    function getRange() external view returns (int24 lower, int24 upper) {
        return (_currentTickLower, _currentTickUpper);
    }

    function getStrategyType()
        external
        pure
        returns (IVaultFactory.StrategyType)
    {
        return IVaultFactory.StrategyType.Shadow;
    }

    function getAumAnnualFee() external view returns (uint256) {
        return _aumAnnualFee;
    }

    function getPendingAumAnnualFee()
        external
        view
        returns (bool isSet, uint256 pendingAumAnnualFee)
    {
        return (_pendingAumAnnualFeeSet, _pendingAumAnnualFee);
    }

    function getBalances()
        external
        view
        returns (uint256 amountX, uint256 amountY)
    {
        return _getBalances();
    }

    function getIdleBalances()
        external
        view
        returns (uint256 amountX, uint256 amountY)
    {
        amountX = _tokenX().balanceOf(address(this));
        amountY = _tokenY().balanceOf(address(this));
    }

    function getLastRebalance() external view returns (uint256) {
        return _lastRebalance;
    }

    function getMaxRange() external view returns (uint256) {
        return _MAX_RANGE;
    }

    function setOperator(address operator) external onlyFactory {
        _operator = operator;
        emit OperatorSet(operator);
    }

    function setRebalanceCoolDown(uint256 coolDown) external onlyFactory {
        _rebalanceCoolDown = coolDown;
        emit RebalanceCoolDownSet(coolDown);
    }

    function setPendingAumAnnualFee(
        uint16 pendingAumAnnualFee
    ) external onlyFactory {
        if (pendingAumAnnualFee > _MAX_AUM_ANNUAL_FEE)
            revert Strategy__InvalidFee();
        _pendingAumAnnualFeeSet = true;
        _pendingAumAnnualFee = pendingAumAnnualFee;
        emit PendingAumAnnualFeeSet(pendingAumAnnualFee);
    }

    function resetPendingAumAnnualFee() external onlyFactory {
        _pendingAumAnnualFeeSet = false;
        _pendingAumAnnualFee = 0;
        emit PendingAumAnnualFeeReset();
    }

    function getNpmLiquidity()
        external
        view
        onlyFactory
        returns (uint128 liquidity, uint128 tokensOwed0, uint128 tokensOwed1)
    {
        INonfungiblePositionManager npm = INonfungiblePositionManager(
            _factory.getShadowNonfungiblePositionManager()
        );

        (, , , , , liquidity, , , tokensOwed0, tokensOwed1) = npm.positions(
            _positionTokenId
        );

        return (liquidity, tokensOwed0, tokensOwed1);
    }

    // ============ IShadowStrategy Implementation ============
    function getPosition()
        external
        view
        returns (uint256 tokenId, int24 tickLower, int24 tickUpper)
    {
        return (_positionTokenId, _currentTickLower, _currentTickUpper);
    }

    function getShadowNonfungiblePositionManager()
        external
        view
        returns (INonfungiblePositionManager)
    {
        return
            INonfungiblePositionManager(
                _factory.getShadowNonfungiblePositionManager()
            );
    }

    // ============ Reward Functions ============
    function getRewardTokens() external view returns (address[] memory) {
        // Early return if no position
        if (_positionTokenId == 0) {
            return new address[](0);
        }

        // Defensive: Wrap all external calls in try-catch
        IMinimalVoter voter;
        try _factory.getShadowVoter() returns (address voterAddress) {
            if (voterAddress == address(0)) {
                return new address[](0);
            }
            voter = IMinimalVoter(voterAddress);
        } catch {
            // Factory call failed
            return new address[](0);
        }
        // Get gauge address defensively
        address gaugeAddress;
        try voter.gaugeForPool(address(_pool())) returns (address gauge) {
            gaugeAddress = gauge;
        } catch {
            // Voter call failed
            return new address[](0);
        }
        if (gaugeAddress == address(0)) {
            return new address[](0);
        }

        // Get reward list defensively
        try IMinimalGauge(gaugeAddress).rewardsList() returns (
            address[] memory tokens
        ) {
            return tokens;
        } catch {
            return new address[](0);
        }
    }

    function hasRewards() external view returns (bool) {
        // Simply check if we have an active position that can earn rewards
        return _positionTokenId != 0;
    }

    function hasExtraRewards() external pure returns (bool) {
        return false; // Shadow doesn't have extra rewards
    }

    function harvestRewards() external onlyTrusted {
        _harvestRewards();
    }

    // ============ Core Functions ============

    function withdrawAll() external onlyVault {
        address vault = _vault();

        // Exit position completely
        _exitPosition();

        // Get current balances
        uint256 balance0 = _tokenX().balanceOf(address(this));
        uint256 balance1 = _tokenY().balanceOf(address(this));

        // Get queued withdrawals info
        uint256 queuedShares = IOracleRewardShadowVault(vault)
            .getCurrentTotalQueuedWithdrawal();

        // Calculate queued amounts (if any)
        uint256 totalSupply = IOracleRewardShadowVault(vault).totalSupply();
        uint256 queuedAmount0 = 0;
        uint256 queuedAmount1 = 0;

        if (totalSupply > 0 && queuedShares > 0) {
            queuedAmount0 = (balance0 * queuedShares) / totalSupply;
            queuedAmount1 = (balance1 * queuedShares) / totalSupply;
        }

        // Execute queued withdrawals
        _transferAndExecuteQueuedAmounts(
            queuedShares,
            queuedAmount0,
            queuedAmount1
        );

        // Transfer remaining tokens to vault
        balance0 = _tokenX().balanceOf(address(this));
        balance1 = _tokenY().balanceOf(address(this));

        if (balance0 > 0) _tokenX().safeTransfer(vault, balance0);
        if (balance1 > 0) _tokenY().safeTransfer(vault, balance1);

        // Try to harvest any remaining rewards
        try this.harvestRewards() {} catch {}
    }

    /**
     * @notice Shadow-specific rebalance, defensive version
     * @param tickLower The lower tick of the new position
     * @param tickUpper The upper tick of the new position
     * @param desiredTick The desired current tick (for slippage check)
     * @param slippageTick The allowed tick slippage
     * @param amountX The amount of token X to deposit
     * @param amountY The amount of token Y to deposit
     */
    function rebalance(
        int24 tickLower,
        int24 tickUpper,
        int24 desiredTick,
        int24 slippageTick,
        uint256 amountX,
        uint256 amountY
    ) external onlyOperators {
        // Pack parameters into struct to reduce stack usage
        RebalanceParams memory params = RebalanceParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            desiredTick: desiredTick,
            slippageTick: slippageTick,
            amountX: amountX,
            amountY: amountY
        });

        emit RebalanceStarted(
            msg.sender,
            params.tickLower,
            params.tickUpper,
            params.amountX,
            params.amountY
        );

        // Step 0: Check cooldown defensively
        if (!_checkCooldown()) {
            emit RebalanceAborted("Cooldown not met", 0);
            return; // Early return
        }
        emit RebalanceStepCount(0);

        // Step 1: Exit current position (includes reward harvesting)
        if (_positionTokenId != 0) {
            bool success = this.exitPositionExternal();
            if (!success) {
                emit RebalanceStepFailed(1, "Exit position failed");
                emit PositionExitFailed(
                    _positionTokenId,
                    "Failed to exit position"
                );
                emit RebalanceAborted("Exit position failed", 1);
                return;
            }
            emit RebalanceStepSuccess(1, bytes32(uint256(1)));
        }
        emit RebalanceStepCount(1);

        // Step 2: Process withdrawals and fees
        bool withdrawalSuccess = this.processWithdrawalsExternal();
        if (!withdrawalSuccess) {
            emit RebalanceStepFailed(2, "Withdrawal processing failed");
            emit WithdrawalProcessingFailed(0, "Failed to process withdrawals");
            emit RebalanceAborted("Withdrawal processing failed", 2);
            return;
        }
        emit RebalanceStepSuccess(2, bytes32(uint256(2)));
        emit RebalanceStepCount(2);

        // Step 3: Rewards already harvested in exit position
        emit RebalanceStepCount(3); // TODO cleanup events

        // Steps 4-6: Enter new position
        _attemptNewPosition(params);
    }

    // Separate function to check cooldown
    function _checkCooldown() internal view returns (bool) {
        uint256 lastRebalance = _lastRebalance;
        if (
            lastRebalance > 0 &&
            block.timestamp < lastRebalance + _rebalanceCoolDown
        ) {
            return false;
        }
        return true;
    }

    // Attempt to enter new position
    function _attemptNewPosition(RebalanceParams memory params) internal {
        // Validate ticks
        if (!_validateTickRange(params.tickLower, params.tickUpper)) {
            emit RebalanceAborted("Tick validation failed", 4);
            return;
        }
        emit RebalanceStepCount(4);

        // Check slippage if needed
        if (
            (params.desiredTick != 0 || params.slippageTick != 0) &&
            !_checkSlippage(params.desiredTick, params.slippageTick)
        ) {
            emit RebalanceAborted("Slippage check failed", 5);
            return;
        }

        // Check amounts
        if (params.amountX == 0 && params.amountY == 0) {
            emit RebalanceAborted("Both amounts are zero", 5);
            return;
        }
        emit RebalanceStepCount(5);

        // Enter position
        _enterNewPositionSafe(params);
    }

    // Enter new position safely
    function _enterNewPositionSafe(RebalanceParams memory params) internal {
        // Get balances and cap amounts
        uint256 availableX = _tokenX().balanceOf(address(this));
        uint256 availableY = _tokenY().balanceOf(address(this));

        if (params.amountX > availableX || params.amountY > availableY) {
            emit InsufficientBalance(
                params.amountX,
                params.amountY,
                availableX,
                availableY
            );
        }

        uint256 depositX = params.amountX > availableX
            ? availableX
            : params.amountX;
        uint256 depositY = params.amountY > availableY
            ? availableY
            : params.amountY;

        try
            this.enterPositionExternal(
                params.tickLower,
                params.tickUpper,
                depositX,
                depositY
            )
        returns (uint256 tokenId) {
            emit RebalanceStepCount(6);
            emit RebalanceCompleted(tokenId, depositX, depositY);
        } catch Error(string memory reason) {
            emit RebalanceStepFailed(6, reason);
            emit RebalanceAborted("Position entry failed", 6);
        } catch {
            emit RebalanceStepFailed(6, "Unknown error");
            emit RebalanceAborted("Position entry failed", 6);
        }
    }

    // Validate tick range
    function _validateTickRange(
        int24 tickLower,
        int24 tickUpper
    ) internal returns (bool) {
        // Basic checks
        if (tickLower < TickMath.MIN_TICK || tickUpper > TickMath.MAX_TICK) {
            emit TickValidationFailed("Out of range", tickLower, tickUpper);
            return false;
        }

        if (tickLower >= tickUpper) {
            emit TickValidationFailed("Invalid order", tickLower, tickUpper);
            return false;
        }

        // Get tick spacing
        int24 tickSpacing;
        try _pool().tickSpacing() returns (int24 spacing) {
            tickSpacing = spacing;
        } catch {
            emit TickValidationFailed("Failed to get spacing", 0, 0);
            return false;
        }
        // Check alignment
        if (tickLower % tickSpacing != 0 || tickUpper % tickSpacing != 0) {
            emit TickValidationFailed("Not aligned", tickLower, tickUpper);
            return false;
        }

        // Check range width
        if (uint24(tickUpper - tickLower) > _MAX_RANGE) {
            emit TickValidationFailed("Range too wide", tickLower, tickUpper);
            return false;
        }

        return true;
    }

    // Check slippage
    function _checkSlippage(
        int24 desiredTick,
        int24 slippageTick
    ) internal returns (bool) {
        int24 currentTick;

        try _pool().slot0() returns (
            uint160,
            int24 tick,
            uint16,
            uint16,
            uint16,
            uint8,
            bool
        ) {
            currentTick = tick;
        } catch {
            emit SlippageCheckFailed(0, desiredTick, slippageTick);
            return false;
        }
        if (
            currentTick < desiredTick - slippageTick ||
            currentTick > desiredTick + slippageTick
        ) {
            emit SlippageCheckFailed(currentTick, desiredTick, slippageTick);
            return false;
        }

        return true;
    }

    // External helper functions for try-catch

    function exitPositionExternal() external returns (bool success) {
        require(msg.sender == address(this), "Only self");
        return _exitPosition();
    }

    function processWithdrawalsExternal() external returns (bool success) {
        require(msg.sender == address(this), "Only self");

        try this._processWithdrawalsInternal() {
            return true;
        } catch {
            return false;
        }
    }

    function _processWithdrawalsInternal() external {
        require(msg.sender == address(this), "Only self");

        // Process withdrawals and apply AUM fee
        (
            uint256 queuedShares,
            uint256 queuedAmountX,
            uint256 queuedAmountY
        ) = _withdrawAndApplyAumAnnualFee();

        // Execute queued withdrawals
        _transferAndExecuteQueuedAmounts(
            queuedShares,
            queuedAmountX,
            queuedAmountY
        );
    }

    function enterPositionExternal(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external returns (uint256) {
        require(msg.sender == address(this), "Only self");

        (uint256 tokenId, , , ) = _enterPosition(
            tickLower,
            tickUpper,
            amount0Desired,
            amount1Desired,
            0,
            0
        );

        return tokenId;
    }
    // ============ Internal Functions ============

    /**
     * @notice Exits the current position completely
     * @dev Burns the NFT after collecting all liquidity and fees
     */
    function _exitPosition() internal returns (bool) {
        if (_positionTokenId == 0) return true;

        INonfungiblePositionManager npm = INonfungiblePositionManager(
            _factory.getShadowNonfungiblePositionManager() // Returns 0x12E66C8F215DdD5d48d150c8f46aD0c6fB0F4406 implementation of npm
        );

        // Get position details
        uint128 liquidity;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
        (, , , , , liquidity, , , tokensOwed0, tokensOwed1) = npm.positions(
            _positionTokenId
        );

        // Step 1: Remove all liquidity if there is any
        if (liquidity > 0) {
            INonfungiblePositionManager.DecreaseLiquidityParams
                memory decreaseParams = INonfungiblePositionManager
                    .DecreaseLiquidityParams({
                        tokenId: _positionTokenId,
                        liquidity: liquidity,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: block.timestamp + 600 // 10 minute timeout
                    });

            try npm.decreaseLiquidity(decreaseParams) {
                emit LiquidityDecreased(_positionTokenId, liquidity);
            } catch Error(string memory reason) {
                emit LiquidityDecreaseFailed(_positionTokenId, reason);
                return false; // Exit early if we can't decrease liquidity
            } catch {
                emit LiquidityDecreaseFailed(_positionTokenId, "Unknown");
                return false;
            }
        }

        // Step 2: Collect all tokens (fees + tokens from liquidity removal)
        // We need to collect twice - once for any existing fees, once for tokens from liquidity removal
        INonfungiblePositionManager.CollectParams
            memory collectParams = INonfungiblePositionManager.CollectParams({
                tokenId: _positionTokenId,
                recipient: address(npm),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        try npm.collect(collectParams) returns (
            uint256 amount0,
            uint256 amount1
        ) {
            emit TokensCollected(_positionTokenId, amount0, amount1);
        } catch Error(string memory reason) {
            emit CollectFailed(_positionTokenId, reason);
            return false; // Exit early if we can't collect
        } catch {
            emit CollectFailed(_positionTokenId, "Unkown");
            return false; // Exit early if we can't collect
        }
        // Step 3: Verify position is ready for burning
        // Check that liquidity is 0 and no tokens are owed
        (, , , , , liquidity, , , tokensOwed0, tokensOwed1) = npm.positions(
            _positionTokenId
        );

        if (liquidity > 0 || tokensOwed0 > 0 || tokensOwed1 > 0) {
            emit PositionNotReadyForBurn(
                _positionTokenId,
                liquidity,
                tokensOwed0,
                tokensOwed1
            );

            // Try one more collection if there are still tokens owed
            if (tokensOwed0 > 0 || tokensOwed1 > 0) {
                try npm.collect(collectParams) returns (
                    uint256 amount0,
                    uint256 amount1
                ) {
                    emit AdditionalTokensCollected(
                        _positionTokenId,
                        amount0,
                        amount1
                    );

                    // Re-check if position is now ready
                    (, , , , , liquidity, , , tokensOwed0, tokensOwed1) = npm
                        .positions(_positionTokenId);
                    if (liquidity > 0 || tokensOwed0 > 0 || tokensOwed1 > 0) {
                        emit PositionNotReadyForBurn(
                            _positionTokenId,
                            liquidity,
                            tokensOwed0,
                            tokensOwed1
                        );
                        return false; // Still not ready, abort burn
                    }
                } catch {
                    // If second collection fails, we can't proceed with burn
                    return false;
                }
            } else {
                // Only liquidity remains, cannot burn
                return false;
            }
        }

        // Step 4: Claim rewards if available (defensive, works for pools with/without gauges)
        _claimRewards(_positionTokenId);

        // Step 5: Burn the NFT
        try npm.burn(_positionTokenId) {
            emit PositionBurned(_positionTokenId);
        } catch {
            emit NftBurnFailure(_positionTokenId);
            // Don't return here - still reset state even if burn fails
        }
        // Step 6: Reset state
        _positionTokenId = 0;
        _currentTickLower = 0;
        _currentTickUpper = 0;

        return true; // Successfully exited position
    }

    /**
     * @notice Claims rewards for a position
     * @param tokenId The NFT token ID to claim rewards for
     */
    function _claimRewards(uint256 tokenId) internal {
        IMinimalVoter voter = IMinimalVoter(_factory.getShadowVoter());
        if (address(voter) == address(0)) return;

        // Get gauge address
        address gauge = voter.gaugeForPool(address(_pool()));
        if (gauge == address(0)) return;

        // Try to get reward token address
        address rewardToken;
        try IMinimalGauge(gauge).rewardToken() returns (address token) {
            rewardToken = token;
        } catch {
            return; // No reward token available
        }
        // Try to claim rewards
        address[] memory tokens = new address[](1);
        tokens[0] = rewardToken;

        INonfungiblePositionManager npm = INonfungiblePositionManager(
            _factory.getShadowNonfungiblePositionManager()
        );

        try npm.getReward(tokenId, tokens) {} catch {
            return; // Claim failed
        }
    }

    /**
     * @notice Enters a new position with the specified parameters
     */
    function _enterPosition(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    )
        internal
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        require(
            _positionTokenId == 0,
            "ShadowStrategy: position already exists"
        );

        INonfungiblePositionManager npm = INonfungiblePositionManager(
            _factory.getShadowNonfungiblePositionManager()
        );

        // Approve tokens to NPM (reset to 0 first to handle non-standard tokens)
        if (amount0Desired > 0) {
            _tokenX().safeApprove(address(npm), 0);
            _tokenX().safeIncreaseAllowance(address(npm), amount0Desired);
        }
        if (amount1Desired > 0) {
            _tokenY().safeApprove(address(npm), 0);
            _tokenY().safeIncreaseAllowance(address(npm), amount1Desired);
        }

        // Get tickSpacing from the pool contract
        int24 tickSpacing = _pool().tickSpacing();

        // Mint new position
        (tokenId, liquidity, amount0, amount1) = npm.mint(
            INonfungiblePositionManager.MintParams({
                token0: address(_tokenX()),
                token1: address(_tokenY()),
                tickSpacing: tickSpacing,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                recipient: address(this),
                deadline: block.timestamp + 600 // 10 minute timeout
            })
        );

        // Store position info
        _positionTokenId = tokenId;
        _currentTickLower = tickLower;
        _currentTickUpper = tickUpper;

        // Remove any remaining approvals
        if (_tokenX().allowance(address(this), address(npm)) > 0) {
            _tokenX().safeApprove(address(npm), 0);
        }
        if (_tokenY().allowance(address(this), address(npm)) > 0) {
            _tokenY().safeApprove(address(npm), 0);
        }

        emit PositionMinted(tokenId, tickLower, tickUpper, liquidity);
    }

    /**
     * @notice Calculate Shadow position value
     */
    function _getBalances()
        internal
        view
        returns (uint256 amountX, uint256 amountY)
    {
        // Get idle balances
        amountX = _tokenX().balanceOf(address(this));
        amountY = _tokenY().balanceOf(address(this));

        // If we have a position, calculate its value
        if (_positionTokenId != 0) {
            INonfungiblePositionManager npm = INonfungiblePositionManager(
                _factory.getShadowNonfungiblePositionManager()
            );

            // Get position info
            (
                ,
                ,
                ,
                int24 tickLower,
                int24 tickUpper,
                uint128 liquidity,
                ,
                ,
                uint128 tokensOwed0,
                uint128 tokensOwed1
            ) = npm.positions(_positionTokenId);

            if (liquidity > 0) {
                // Get current tick from pool
                (, int24 currentTick, , , , , ) = _pool().slot0();

                // Calculate amounts using LiquidityAmounts library
                uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(currentTick);
                uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
                uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);

                (uint256 amount0, uint256 amount1) = LiquidityAmounts
                    .getAmountsForLiquidity(
                        sqrtPriceX96,
                        sqrtRatioAX96,
                        sqrtRatioBX96,
                        liquidity
                    );

                amountX += amount0;
                amountY += amount1;
            }

            // Add tokens owed (uncollected fees)
            amountX += tokensOwed0;
            amountY += tokensOwed1;
        }
    }

    /**
     * @notice Withdraws and applies AUM annual fee
     */
    function _withdrawAndApplyAumAnnualFee()
        internal
        returns (
            uint256 queuedShares,
            uint256 queuedAmountX,
            uint256 queuedAmountY
        )
    {
        // Get the queued shares
        queuedShares = IOracleRewardShadowVault(_vault())
            .getCurrentTotalQueuedWithdrawal();

        // Get total balances
        (uint256 totalBalanceX, uint256 totalBalanceY) = _getBalances();

        // Calculate queued amounts
        uint256 totalSupply = IOracleRewardShadowVault(_vault()).totalSupply();
        if (totalSupply > 0 && queuedShares > 0) {
            queuedAmountX = queuedShares.mulDivRoundDown(
                totalBalanceX,
                totalSupply
            );
            queuedAmountY = queuedShares.mulDivRoundDown(
                totalBalanceY,
                totalSupply
            );
        }

        // Update last rebalance timestamp
        uint256 lastRebalance = _lastRebalance;
        _lastRebalance = block.timestamp.safe64();

        // If the total balance is 0, early return
        if (totalBalanceX == 0 && totalBalanceY == 0)
            return (queuedShares, queuedAmountX, queuedAmountY);

        // Apply the AUM annual fee
        if (lastRebalance < block.timestamp) {
            uint256 annualFee = _aumAnnualFee;

            if (annualFee > 0) {
                address feeRecipient = _factory.getFeeRecipientByVault(
                    _vault()
                );

                // Get the duration and cap it to 1 day
                uint256 duration = block.timestamp - lastRebalance;
                duration = duration > 1 days ? 1 days : duration;

                // Calculate and transfer fees
                uint256 feeX = (totalBalanceX *
                    annualFee *
                    duration +
                    _SCALED_YEAR_SUB_ONE) / _SCALED_YEAR;
                uint256 feeY = (totalBalanceY *
                    annualFee *
                    duration +
                    _SCALED_YEAR_SUB_ONE) / _SCALED_YEAR;

                if (feeX > 0) {
                    queuedAmountX = queuedAmountX == 0
                        ? 0
                        : queuedAmountX -
                            feeX.mulDivRoundUp(queuedAmountX, totalBalanceX);
                    _tokenX().safeTransfer(feeRecipient, feeX);
                }
                if (feeY > 0) {
                    queuedAmountY = queuedAmountY == 0
                        ? 0
                        : queuedAmountY -
                            feeY.mulDivRoundUp(queuedAmountY, totalBalanceY);
                    _tokenY().safeTransfer(feeRecipient, feeY);
                }

                emit AumFeeCollected(
                    msg.sender,
                    totalBalanceX,
                    totalBalanceY,
                    feeX,
                    feeY
                );
            }
        }

        // Update the pending AUM annual fee if needed
        if (_pendingAumAnnualFeeSet) {
            _pendingAumAnnualFeeSet = false;
            uint16 pendingAumAnnualFee = _pendingAumAnnualFee;
            _pendingAumAnnualFee = 0;
            _aumAnnualFee = pendingAumAnnualFee;
            emit AumAnnualFeeSet(pendingAumAnnualFee);
        }
    }

    /**
     * @notice Transfer and execute queued amounts
     */
    function _transferAndExecuteQueuedAmounts(
        uint256 queuedShares,
        uint256 queuedAmountX,
        uint256 queuedAmountY
    ) private {
        if (queuedShares > 0) {
            address vault = _vault();

            // Transfer the tokens to the vault and execute the queued withdrawals
            if (queuedAmountX > 0) _tokenX().safeTransfer(vault, queuedAmountX);
            if (queuedAmountY > 0) _tokenY().safeTransfer(vault, queuedAmountY);

            IOracleRewardShadowVault(vault).executeQueuedWithdrawals();
        }
    }

    /**
     * @dev Harvests the rewards from the Shadow position NFT via the gauge system.
     */
    function _harvestRewards() internal {
        if (_positionTokenId == 0) return;

        // Get gauge address with defensive programming
        address gaugeAddress = _getGaugeAddressSafely();
        if (gaugeAddress == address(0)) return;

        IMinimalGauge gauge = IMinimalGauge(gaugeAddress);

        // Discover rewards defensively
        address[] memory rewardTokens;
        try gauge.rewardsList() returns (address[] memory tokens) {
            rewardTokens = tokens;
            emit RewardTokensDiscovered(tokens);
        } catch {
            emit RewardDiscoveryFailed(gaugeAddress);
            return;
        }
        if (rewardTokens.length == 0) return;

        // Check earned amounts before claiming
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            try gauge.earned(rewardTokens[i], address(this)) returns (
                uint256 amount
            ) {
                if (amount > 0) {
                    emit RewardEarned(rewardTokens[i], amount);
                }
            } catch {
                // Continue with other tokens even if one fails
            }
        }

        // Track balances before claiming
        uint256[] memory balancesBefore = new uint256[](rewardTokens.length);
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            balancesBefore[i] = _getTokenBalanceSafely(rewardTokens[i]);
        }

        // Try to claim with xSHADOW conversion first
        bool claimSuccess = false;
        try gauge.getRewardAndExit(address(this), rewardTokens) {
            claimSuccess = true;
        } catch {
            emit XShadowConversionFailed();
            // Fallback to regular claim
            try gauge.getReward(address(this), rewardTokens) {
                claimSuccess = true;
            } catch {
                emit RewardClaimFailed(rewardTokens);
            }
        }
        if (!claimSuccess) return;

        // Process claimed rewards
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            uint256 balanceAfter = _getTokenBalanceSafely(rewardTokens[i]);
            uint256 received = balanceAfter > balancesBefore[i]
                ? balanceAfter - balancesBefore[i]
                : 0;

            if (received > 0) {
                emit RewardClaimed(rewardTokens[i], received);

                // Forward to vault with defensive programming
                _forwardRewardToVault(IERC20(rewardTokens[i]), received);
            }
        }
    }

    /**
     * @notice Notify vault of reward token if needed
     */
    function _notifyVault(IERC20 rewardToken) internal {
        if (_factory.getVaultType(_vault()) != IVaultFactory.VaultType.Simple) {
            IOracleRewardVault(_vault()).notifyRewardToken(rewardToken);
        }
    }

    /**
     * @notice Helper function for safe token balance checking
     */
    function _getTokenBalanceSafely(
        address token
    ) internal view returns (uint256) {
        if (token == address(0)) return 0;

        try IERC20(token).balanceOf(address(this)) returns (uint256 balance) {
            return balance;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Helper function for safe gauge address retrieval
     */
    function _getGaugeAddressSafely() internal view returns (address) {
        try _factory.getShadowVoter() returns (address voterAddress) {
            if (voterAddress == address(0)) return address(0);

            try
                IMinimalVoter(voterAddress).gaugeForPool(address(_pool()))
            returns (address gauge) {
                return gauge;
            } catch {
                return address(0);
            }
        } catch {
            return address(0);
        }
    }

    /**
     * @notice Helper function for safe reward forwarding
     */
    function _forwardRewardToVault(IERC20 token, uint256 amount) internal {
        address vault = _vault();

        // Notify vault about the reward token (defensive)
        try IOracleRewardVault(vault).notifyRewardToken(token) {
            // Success
        } catch {
            // Continue anyway - vault might already know about this token
        }
        // Transfer to vault (defensive)
        try token.transfer(vault, amount) returns (bool success) {
            if (success) {
                emit RewardForwarded(address(token), vault, amount);
            }
        } catch {
            // Log failure but don't revert
            emit RewardForwarded(address(token), vault, 0);
        }
        // Update vault accounting (defensive)
        if (_factory.getVaultType(vault) != IVaultFactory.VaultType.Simple) {
            try IOracleRewardVault(vault).updateAccRewardsPerShare() {
                // Success
            } catch {
                // Log non-critical failure for debugging
                emit VaultAccountingUpdateFailed(vault);
            }
        }
    }

    /**
     * @notice Get comprehensive reward status for monitoring
     * @return tokens Array of reward token addresses
     * @return earned Array of earned amounts for each token
     * @return gauge The gauge address
     * @return hasActivePosition Whether there's an active position
     */
    function getRewardStatus()
        external
        view
        returns (
            address[] memory tokens,
            uint256[] memory earned,
            address gauge,
            bool hasActivePosition
        )
    {
        hasActivePosition = _positionTokenId != 0;
        gauge = _getGaugeAddressSafely();

        if (!hasActivePosition || gauge == address(0)) {
            return (
                new address[](0),
                new uint256[](0),
                gauge,
                hasActivePosition
            );
        }

        // Get tokens defensively
        try IMinimalGauge(gauge).rewardsList() returns (
            address[] memory rewardTokens
        ) {
            tokens = rewardTokens;
            earned = new uint256[](tokens.length);

            // Get earned amounts defensively
            for (uint256 i = 0; i < tokens.length; i++) {
                try
                    IMinimalGauge(gauge).earned(tokens[i], address(this))
                returns (uint256 amount) {
                    earned[i] = amount;
                } catch {
                    earned[i] = 0;
                }
            }
        } catch {
            tokens = new address[](0);
            earned = new uint256[](0);
        }
    }
}

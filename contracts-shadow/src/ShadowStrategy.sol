// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {Clone} from "joe-v2/libraries/Clone.sol";
import {IERC20Upgradeable} from "openzeppelin-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "openzeppelin-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {ReentrancyGuardUpgradeable} from "openzeppelin-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeCast} from "joe-v2/libraries/math/SafeCast.sol";
import {IERC20} from "joe-v2/interfaces/ILBPair.sol";

import {IVaultFactory} from "../../contracts-metropolis/src/interfaces/IVaultFactory.sol";
import {IStrategyCommon} from "../../contracts-metropolis/src/interfaces/IStrategyCommon.sol";
import {IShadowStrategy} from "./interfaces/IShadowStrategy.sol";
import {INonfungiblePositionManager} from "../CL/periphery/interfaces/INonfungiblePositionManager.sol";
import {IRamsesV3Pool} from "../CL/core/interfaces/IRamsesV3Pool.sol";
import {IMinimalGauge} from "./interfaces/IMinimalGauge.sol";
import {IMinimalVoter} from "./interfaces/IMinimalVoter.sol";
import {LiquidityAmounts} from "../CL/periphery/libraries/LiquidityAmounts.sol";
import {TickMath} from "../CL/core/libraries/TickMath.sol";
import {FullMath} from "../CL/core/libraries/FullMath.sol";
import {FixedPoint128} from "../CL/core/libraries/FixedPoint128.sol";
import {PoolAddress} from "../CL/periphery/libraries/PoolAddress.sol";
import {IOracleRewardVault} from "../../contracts-metropolis/src/interfaces/IOracleRewardVault.sol";
import {TokenHelper} from "../../contracts-metropolis/src/libraries/TokenHelper.sol";
import {Math} from "../../contracts-metropolis/src/libraries/Math.sol";
import {IOracleRewardShadowVault} from "./interfaces/IOracleRewardShadowVault.sol";
import {Uint256x256Math} from "joe-v2/libraries/math/Uint256x256Math.sol";

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

    uint256 private constant _PRECISION = 1e18;
    uint256 private constant _BASIS_POINTS = 1e4;
    uint256 private constant _MAX_AUM_ANNUAL_FEE = 0.3e4; // 30%
    uint256 private constant _SCALED_YEAR = 365 days * _BASIS_POINTS;
    uint256 private constant _SCALED_YEAR_SUB_ONE = _SCALED_YEAR - 1;

    IVaultFactory private immutable _factory;
    uint256 private immutable _MAX_RANGE;

    // Position tracking state
    uint256 private _positionTokenId;  // 0 means no position
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
        if (msg.sender != _operator && msg.sender != _factory.getDefaultOperator()) revert Strategy__OnlyOperators();
        _;
    }

    modifier onlyTrusted() {
        if (msg.sender != _operator 
            && msg.sender != _factory.getDefaultOperator() 
            && msg.sender != address(this) 
            && msg.sender != _vault()
            ) revert Strategy__OnlyTrusted();
        _;
    }

    modifier onlyDefaultOperator() {
        if (msg.sender != _factory.getDefaultOperator()) revert Strategy__OnlyDefaultOperator();
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

    function getRange() external view returns (int32 lower, int32 upper) {
        return (int32(_currentTickLower), int32(_currentTickUpper));
    }

    function getStrategyType() external pure returns (IVaultFactory.StrategyType) {
        return IVaultFactory.StrategyType.Shadow;
    }

    function getAumAnnualFee() external view returns (uint256) {
        return _aumAnnualFee;
    }

    function getPendingAumAnnualFee() external view returns (bool isSet, uint256 pendingAumAnnualFee) {
        return (_pendingAumAnnualFeeSet, _pendingAumAnnualFee);
    }

    function getBalances() external view returns (uint256 amountX, uint256 amountY) {
        return _getBalances();
    }

    function getIdleBalances() external view returns (uint256 amountX, uint256 amountY) {
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

    function setPendingAumAnnualFee(uint16 pendingAumAnnualFee) external onlyFactory {
        if (pendingAumAnnualFee > _MAX_AUM_ANNUAL_FEE) revert Strategy__InvalidFee();
        _pendingAumAnnualFeeSet = true;
        _pendingAumAnnualFee = pendingAumAnnualFee;
        emit PendingAumAnnualFeeSet(pendingAumAnnualFee);
    }

    function resetPendingAumAnnualFee() external onlyFactory {
        _pendingAumAnnualFeeSet = false;
        _pendingAumAnnualFee = 0;
        emit PendingAumAnnualFeeReset();
    }

    // ============ IShadowStrategy Implementation ============

    function getPosition() external view returns (uint256 tokenId, int24 tickLower, int24 tickUpper) {
        return (_positionTokenId, _currentTickLower, _currentTickUpper);
    }

    function getShadowNonfungiblePositionManager() external view returns (INonfungiblePositionManager) {
        return INonfungiblePositionManager(_factory.getShadowNonfungiblePositionManager());
    }

    function getVoter() external view returns (IMinimalVoter) {
        return IMinimalVoter(_factory.getShadowVoter());
    }

    // ============ Reward Functions ============

    function getRewardToken() external view returns (IERC20) {
        IMinimalVoter voter = IMinimalVoter(_factory.getShadowVoter());
        if (address(voter) == address(0)) return IERC20(address(0));
        
        address gauge = voter.gaugeForPool(address(_pool()));
        if (gauge == address(0)) return IERC20(address(0));
        
        return IERC20(IMinimalGauge(gauge).rewardToken());
    }

    function getExtraRewardToken() external view returns (IERC20) {
        // Shadow doesn't have extra rewards in the same way as Metropolis
        return IERC20(address(0));
    }

    function hasRewards() external view returns (bool) {
        IMinimalVoter voter = IMinimalVoter(_factory.getShadowVoter());
        if (address(voter) == address(0)) return false;
        
        return voter.gaugeForPool(address(_pool())) != address(0);
    }

    function hasExtraRewards() external view returns (bool) {
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
        uint256 queuedShares = IOracleRewardShadowVault(vault).getCurrentTotalQueuedWithdrawal();
        
        // Calculate queued amounts (if any)
        uint256 totalSupply = IOracleRewardShadowVault(vault).totalSupply();
        uint256 queuedAmount0 = 0;
        uint256 queuedAmount1 = 0;
        
        if (totalSupply > 0 && queuedShares > 0) {
            queuedAmount0 = balance0 * queuedShares / totalSupply;
            queuedAmount1 = balance1 * queuedShares / totalSupply;
        }
        
        // Execute queued withdrawals
        _transferAndExecuteQueuedAmounts(queuedShares, queuedAmount0, queuedAmount1);
        
        // Transfer remaining tokens to vault
        balance0 = _tokenX().balanceOf(address(this));
        balance1 = _tokenY().balanceOf(address(this));
        
        if (balance0 > 0) _tokenX().safeTransfer(vault, balance0);
        if (balance1 > 0) _tokenY().safeTransfer(vault, balance1);
        
        // Try to harvest any remaining rewards
        try this.harvestRewards() {} catch {}
    }

    /**
     * @notice Shadow-specific rebalance
     * @param tickLower The lower tick of the new position
     * @param tickUpper The upper tick of the new position
     * @param desiredTick The desired current tick (for slippage check)
     * @param slippageTick The allowed tick slippage
     */
    function rebalance(
        int32 tickLower,
        int32 tickUpper,
        int32 desiredTick,
        int32 slippageTick
    ) external onlyOperators {
        // Check cooldown
        uint256 lastRebalance = _lastRebalance;
        if (lastRebalance > 0 && block.timestamp < lastRebalance + _rebalanceCoolDown) {
            revert Strategy__RebalanceCoolDown();
        }

        // Exit current position if it exists
        _exitPosition();
        
        // Process withdrawals and apply AUM fee
        (uint256 queuedShares, uint256 queuedAmountX, uint256 queuedAmountY) = _withdrawAndApplyAumAnnualFee();
        
        // Execute queued withdrawals
        _transferAndExecuteQueuedAmounts(queuedShares, queuedAmountX, queuedAmountY);
        
        // Try to harvest rewards
        try this.harvestRewards() {} catch {}
        
        // Validate tick range
        require(tickLower >= TickMath.MIN_TICK && tickUpper <= TickMath.MAX_TICK, "ShadowStrategy: tick out of range");
        require(tickLower < tickUpper, "ShadowStrategy: invalid range");
        
        // Check if we should enter a new position
        if (tickUpper > tickLower) {
            // Convert to int24 for Shadow ticks
            int24 tickLower24 = int24(tickLower);
            int24 tickUpper24 = int24(tickUpper);
            
            // Validate tick spacing
            int24 tickSpacing = _pool().tickSpacing();
            _validateTicks(tickLower24, tickUpper24, tickSpacing);
            
            // Check slippage
            if (desiredTick != 0 || slippageTick != 0) {
                (, int24 currentTick,,,,,) = _pool().slot0();
                _validateActiveTickSlippage(int32(currentTick), desiredTick, slippageTick);
            }
            
            // Get current balances
            uint256 balance0 = _tokenX().balanceOf(address(this));
            uint256 balance1 = _tokenY().balanceOf(address(this));
            
            // Enter new position if we have tokens
            if (balance0 > 0 || balance1 > 0) {
                _enterPosition(
                    tickLower24,
                    tickUpper24,
                    balance0,
                    balance1,
                    0, // amount0Min
                    0  // amount1Min
                );
            }
        }
    }

    // ============ Internal Functions ============

    /**
     * @notice Validates that ticks are properly aligned with tick spacing
     */
    function _validateTicks(int24 tickLower, int24 tickUpper, int24 tickSpacing) internal view {
        require(tickLower % tickSpacing == 0, "ShadowStrategy: tickLower not aligned");
        require(tickUpper % tickSpacing == 0, "ShadowStrategy: tickUpper not aligned");
        require(uint24(tickUpper - tickLower) <= _MAX_RANGE, "ShadowStrategy: range too wide");
    }

    /**
     * @notice Validates active tick slippage
     */
    function _validateActiveTickSlippage(int32 currentTick, int32 desiredTick, int32 slippageTick) internal pure {
        if (currentTick < desiredTick - slippageTick || currentTick > desiredTick + slippageTick) {
            revert Strategy__ActiveIdSlippage();
        }
    }

    /**
     * @notice Exits the current position completely
     * @dev Burns the NFT after collecting all liquidity and fees
     */
    function _exitPosition() internal {
        if (_positionTokenId == 0) return;

        INonfungiblePositionManager npm = INonfungiblePositionManager(_factory.getShadowNonfungiblePositionManager());
        
        // Get position details
        uint128 liquidity;
        (,,,,, liquidity,,,,) = npm.positions(_positionTokenId);

        // Only decrease liquidity if there is any
        if (liquidity > 0) {
            // Remove all liquidity
            INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = 
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: _positionTokenId,
                    liquidity: liquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                });
            
            npm.decreaseLiquidity(decreaseParams);
        }

        // Collect all tokens (including fees)
        INonfungiblePositionManager.CollectParams memory collectParams = 
            INonfungiblePositionManager.CollectParams({
                tokenId: _positionTokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });
        
        npm.collect(collectParams);

        // Claim rewards if gauge exists
        _claimRewards(_positionTokenId);

        // Burn the NFT
        npm.burn(_positionTokenId);

        emit PositionBurned(_positionTokenId);

        // Reset state
        _positionTokenId = 0;
        _currentTickLower = 0;
        _currentTickUpper = 0;
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

        // Claim rewards
        address[] memory tokens = new address[](1);
        tokens[0] = IMinimalGauge(gauge).rewardToken();
        
        INonfungiblePositionManager npm = INonfungiblePositionManager(_factory.getShadowNonfungiblePositionManager());
        
        // Try to claim rewards, return early if it fails
        try npm.getReward(tokenId, tokens) {} catch {
            return;
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
    ) internal returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) {
        require(_positionTokenId == 0, "ShadowStrategy: position already exists");
        
        INonfungiblePositionManager npm = INonfungiblePositionManager(_factory.getShadowNonfungiblePositionManager());
        
        // Approve tokens to NPM (reset to 0 first to handle non-standard tokens)
        if (amount0Desired > 0) {
            _tokenX().safeApprove(address(npm), 0);
            _tokenX().safeApprove(address(npm), amount0Desired);
        }
        if (amount1Desired > 0) {
            _tokenY().safeApprove(address(npm), 0);
            _tokenY().safeApprove(address(npm), amount1Desired);
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
                deadline: block.timestamp
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
    function _getBalances() internal view returns (uint256 amountX, uint256 amountY) {
        // Get idle balances
        amountX = _tokenX().balanceOf(address(this));
        amountY = _tokenY().balanceOf(address(this));
        
        // If we have a position, calculate its value
        if (_positionTokenId != 0) {
            INonfungiblePositionManager npm = INonfungiblePositionManager(_factory.getShadowNonfungiblePositionManager());
            
            // Get position info
            (,,,int24 tickLower, int24 tickUpper, uint128 liquidity,,, uint128 tokensOwed0, uint128 tokensOwed1) = 
                npm.positions(_positionTokenId);
            
            if (liquidity > 0) {
                // Get current tick from pool
                (, int24 currentTick,,,,,) = _pool().slot0();
                
                // Calculate amounts using LiquidityAmounts library
                uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(currentTick);
                uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
                uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
                
                (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
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
        returns (uint256 queuedShares, uint256 queuedAmountX, uint256 queuedAmountY)
    {
        // Get the queued shares
        queuedShares = IOracleRewardShadowVault(_vault()).getCurrentTotalQueuedWithdrawal();
        
        // Get total balances
        (uint256 totalBalanceX, uint256 totalBalanceY) = _getBalances();
        
        // Calculate queued amounts
        uint256 totalSupply = IOracleRewardShadowVault(_vault()).totalSupply();
        if (totalSupply > 0 && queuedShares > 0) {
            queuedAmountX = queuedShares.mulDivRoundDown(totalBalanceX, totalSupply);
            queuedAmountY = queuedShares.mulDivRoundDown(totalBalanceY, totalSupply);
        }

        // Update last rebalance timestamp
        uint256 lastRebalance = _lastRebalance;
        _lastRebalance = block.timestamp.safe64();

        // If the total balance is 0, early return
        if (totalBalanceX == 0 && totalBalanceY == 0) return (queuedShares, queuedAmountX, queuedAmountY);

        // Apply the AUM annual fee
        if (lastRebalance < block.timestamp) {
            uint256 annualFee = _aumAnnualFee;

            if (annualFee > 0) {
                address feeRecipient = _factory.getFeeRecipientByVault(_vault());

                // Get the duration and cap it to 1 day
                uint256 duration = block.timestamp - lastRebalance;
                duration = duration > 1 days ? 1 days : duration;

                // Calculate and transfer fees
                uint256 feeX = (totalBalanceX * annualFee * duration + _SCALED_YEAR_SUB_ONE) / _SCALED_YEAR;
                uint256 feeY = (totalBalanceY * annualFee * duration + _SCALED_YEAR_SUB_ONE) / _SCALED_YEAR;

                if (feeX > 0) {
                    queuedAmountX = queuedAmountX == 0 ? 0 : queuedAmountX - feeX.mulDivRoundUp(queuedAmountX, totalBalanceX);
                    _tokenX().safeTransfer(feeRecipient, feeX);
                }
                if (feeY > 0) {
                    queuedAmountY = queuedAmountY == 0 ? 0 : queuedAmountY - feeY.mulDivRoundUp(queuedAmountY, totalBalanceY);
                    _tokenY().safeTransfer(feeRecipient, feeY);
                }

                emit AumFeeCollected(msg.sender, totalBalanceX, totalBalanceY, feeX, feeY);
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
    function _transferAndExecuteQueuedAmounts(uint256 queuedShares, uint256 queuedAmountX, uint256 queuedAmountY)
        private
    {
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
        
        IMinimalVoter voter = IMinimalVoter(_factory.getShadowVoter());
        if (address(voter) == address(0)) return;
        
        // Get gauge address for the pool
        address gauge = voter.gaugeForPool(address(_pool()));
        if (gauge == address(0)) return;
        
        // Get the reward token from the gauge
        address rewardToken = IMinimalGauge(gauge).rewardToken();
        if (rewardToken == address(0)) return;
        
        // Track balance before claiming
        uint256 balanceBefore = IERC20(rewardToken).balanceOf(address(this));
        
        // Claim rewards for the NFT position
        address[] memory tokens = new address[](1);
        tokens[0] = rewardToken;
        
        INonfungiblePositionManager npm = INonfungiblePositionManager(_factory.getShadowNonfungiblePositionManager());
        
        try npm.getReward(_positionTokenId, tokens) {} catch {
            return;
        }
        
        // Calculate reward amount
        uint256 balanceAfter = IERC20(rewardToken).balanceOf(address(this));
        uint256 rewardAmount = balanceAfter - balanceBefore;
        
        if (rewardAmount > 0) {
            // Notify the vault about the reward token
            _notifyVault(IERC20(rewardToken));
            
            // Transfer rewards to the vault
            TokenHelper.safeTransfer(IERC20(rewardToken), _vault(), rewardAmount);
            
            // Update vault's reward accounting
            if (_factory.getVaultType(_vault()) != IVaultFactory.VaultType.Simple) {
                IOracleRewardVault(_vault()).updateAccRewardsPerShare();
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
}
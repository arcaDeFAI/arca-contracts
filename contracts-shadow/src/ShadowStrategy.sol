// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {Strategy} from "../../contracts-metropolis/src/Strategy.sol";
import {IVaultFactory} from "../../contracts-metropolis/src/interfaces/IVaultFactory.sol";
import {IBaseVault} from "../../contracts-metropolis/src/interfaces/IBaseVault.sol";
import {IERC20Upgradeable} from "openzeppelin-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "openzeppelin-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {INonfungiblePositionManager} from "../CL/periphery/interfaces/INonfungiblePositionManager.sol";
import {IRamsesV3Pool} from "../CL/core/interfaces/IRamsesV3Pool.sol";
import {IMinimalGauge} from "./interfaces/IMinimalGauge.sol";
import {IMinimalVoter} from "./interfaces/IMinimalVoter.sol";
import {LiquidityAmounts} from "../CL/periphery/libraries/LiquidityAmounts.sol";
import {TickMath} from "../CL/core/libraries/TickMath.sol";
import {FullMath} from "../CL/core/libraries/FullMath.sol";
import {FixedPoint128} from "../CL/core/libraries/FixedPoint128.sol";
import {PoolAddress} from "../CL/periphery/libraries/PoolAddress.sol";

/**
 * @title Shadow Strategy Contract
 * @author Arca
 * @notice Strategy for managing Shadow (Ramses V3) concentrated liquidity positions
 * @dev Inherits from Metropolis Strategy but overrides key functions for NFT-based positions
 */
contract ShadowStrategy is Strategy {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Position tracking state
    uint256 private _positionTokenId;  // 0 means no position
    int24 private _currentTickLower;
    int24 private _currentTickUpper;
    int24 private _tickSpacing;

    /// @notice Events
    event PositionMinted(uint256 indexed tokenId, int24 tickLower, int24 tickUpper, uint128 liquidity);
    event PositionBurned(uint256 indexed tokenId);

    /**
     * @dev Constructor of the contract.
     * @param factory The address of the factory.
     * @param maxRange The max range of the strategy (in ticks, not bins).
     */
    constructor(IVaultFactory factory, uint256 maxRange) Strategy(factory, maxRange) {}

    /**
     * @notice Returns the current position details
     * @return tokenId The NFT token ID (0 if no position)
     * @return tickLower The lower tick of the position
     * @return tickUpper The upper tick of the position
     */
    function getPosition() external view returns (uint256 tokenId, int24 tickLower, int24 tickUpper) {
        return (_positionTokenId, _currentTickLower, _currentTickUpper);
    }

    /**
     * @notice Returns the Nonfungible Position Manager address
     * @dev Gets the address from the factory configuration
     */
    function getNonfungiblePositionManager() public view returns (INonfungiblePositionManager) {
        return INonfungiblePositionManager(this.getFactory().getNonfungiblePositionManager());
    }

    /**
     * @notice Returns the voter address for gauge lookups
     * @dev Gets the address from the factory configuration
     */
    function getVoter() public view returns (IMinimalVoter) {
        return IMinimalVoter(this.getFactory().getShadowVoter());
    }

    /**
     * @notice Validates that ticks are properly aligned with tick spacing
     * @param tickLower The lower tick to validate
     * @param tickUpper The upper tick to validate
     * @param tickSpacing The tick spacing of the pool
     */
    function _validateTicks(int24 tickLower, int24 tickUpper, int24 tickSpacing) internal pure {
        require(tickLower < tickUpper, "ShadowStrategy: tickLower >= tickUpper");
        require(tickLower % tickSpacing == 0, "ShadowStrategy: tickLower not aligned");
        require(tickUpper % tickSpacing == 0, "ShadowStrategy: tickUpper not aligned");
        require(tickLower >= TickMath.MIN_TICK, "ShadowStrategy: tickLower too low");
        require(tickUpper <= TickMath.MAX_TICK, "ShadowStrategy: tickUpper too high");
    }

    /**
     * @notice Exits the current position completely
     * @dev Burns the NFT after collecting all liquidity and fees
     */
    function _exitPosition() internal {
        if (_positionTokenId == 0) return;

        INonfungiblePositionManager npm = getNonfungiblePositionManager();
        
        // Get position details
        (,,, int24 tickLower, int24 tickUpper, uint128 liquidity,,,,) = npm.positions(_positionTokenId);

        // Only decrease liquidity if there is any
        if (liquidity > 0) {
            // Remove all liquidity
            INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = 
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: _positionTokenId,
                    liquidity: liquidity,
                    amount0Min: 0, // Accept any amount for simplicity
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

        // Try to claim rewards if gauge exists
        try this._claimRewards(_positionTokenId) {} catch {}

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
    function _claimRewards(uint256 tokenId) external {
        require(msg.sender == address(this), "ShadowStrategy: only self");
        
        IMinimalVoter voter = getVoter();
        if (address(voter) == address(0)) return;

        // Get gauge address
        address pool = _getPoolAddress();
        address gauge = voter.gaugeForPool(pool);
        if (gauge == address(0)) return;

        // For MVP, claim single reward token
        address[] memory tokens = new address[](1);
        tokens[0] = IMinimalGauge(gauge).rewardToken();
        
        INonfungiblePositionManager npm = getNonfungiblePositionManager();
        npm.getReward(tokenId, tokens);
    }

    /**
     * @notice Gets the pool address for the current token pair
     */
    function _getPoolAddress() internal view returns (address) {
        if (_tickSpacing == 0) return address(0);
        
        INonfungiblePositionManager npm = getNonfungiblePositionManager();
        address deployer = npm.deployer();
        
        PoolAddress.PoolKey memory poolKey = PoolAddress.getPoolKey(
            address(_tokenX()),
            address(_tokenY()),
            _tickSpacing
        );
        
        return PoolAddress.computeAddress(deployer, poolKey);
    }

    /**
     * @notice Enters a new position with the specified parameters
     * @param tickLower The lower tick of the position
     * @param tickUpper The upper tick of the position
     * @param tickSpacing The tick spacing of the pool
     * @param amount0Desired The desired amount of token0 to deposit
     * @param amount1Desired The desired amount of token1 to deposit
     * @param amount0Min Minimum amount of token0 (slippage protection)
     * @param amount1Min Minimum amount of token1 (slippage protection)
     */
    function _enterPosition(
        int24 tickLower,
        int24 tickUpper,
        int24 tickSpacing,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) internal returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) {
        require(_positionTokenId == 0, "ShadowStrategy: position already exists");
        
        _validateTicks(tickLower, tickUpper, tickSpacing);
        
        INonfungiblePositionManager npm = getNonfungiblePositionManager();
        
        // Approve tokens to NPM
        if (amount0Desired > 0) {
            _tokenX().safeApprove(address(npm), amount0Desired);
        }
        if (amount1Desired > 0) {
            _tokenY().safeApprove(address(npm), amount1Desired);
        }
        
        // Mint new position - build params inline to avoid stack too deep
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
        _tickSpacing = tickSpacing;
        
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
     * @notice Override rebalance for Shadow strategy
     * @dev This completely replaces the parent's bin-based rebalance with tick-based logic
     * @param newLower The lower tick of the new position (as int32)
     * @param newUpper The upper tick of the new position (as int32)
     * @param desiredActiveId The desired active tick (as int32)
     * @param slippageActiveId The allowed tick slippage (as int32)
     * @param amountX The amount of token X to deposit
     * @param amountY The amount of token Y to deposit
     * @param distributions Not used for Shadow (ignored)
     */
    function rebalance(
        int32 newLower,
        int32 newUpper,
        int32 desiredActiveId,
        int32 slippageActiveId,
        uint256 amountX,
        uint256 amountY,
        bytes calldata distributions
    ) external override onlyOperators {
        // Check cooldown using parent's getter
        uint256 lastRebalance = this.getLastRebalance();
        if (lastRebalance > 0 && block.timestamp < lastRebalance + 5 seconds) {
            revert Strategy__RebalanceCoolDown();
        }

        // For Shadow, we need to exit the current position first if it exists
        _exitPosition();
        
        // Now we can use parent's AUM fee logic since we've already exited our position
        // This will handle fee calculation and reset the range
        (uint256 queuedShares, uint256 queuedAmountX, uint256 queuedAmountY) = _withdrawAndApplyAumAnnualFee();
        
        // Execute queued withdrawals
        _transferAndExecuteQueuedAmountsShadow(queuedShares, queuedAmountX, queuedAmountY);
        
        // Try to harvest rewards
        try this.harvestRewards() {} catch {}
        
        // Validate tick range
        require(newLower >= TickMath.MIN_TICK && newUpper <= TickMath.MAX_TICK, "ShadowStrategy: tick out of range");
        
        // Convert to int24 for Shadow ticks
        int24 tickLower = int24(newLower);
        int24 tickUpper = int24(newUpper);
        
        // Check if we should enter a new position
        if (tickUpper > tickLower) {
            // Get tick spacing from the pool
            address pool = _getPoolAddress();
            int24 tickSpacing = 0;
            if (pool != address(0)) {
                tickSpacing = IRamsesV3Pool(pool).tickSpacing();
            }
            
            // Validate ticks
            _validateTicks(tickLower, tickUpper, tickSpacing);
            
            // Get current balances
            uint256 balance0 = _tokenX().balanceOf(address(this));
            uint256 balance1 = _tokenY().balanceOf(address(this));
            
            // Enter new position if we have tokens
            if (balance0 > 0 || balance1 > 0) {
                // For Shadow, we don't use distributions, just deposit all available balance
                // Min amounts are set to 0 for simplicity (can be calculated based on slippage)
                _enterPosition(
                    tickLower,
                    tickUpper,
                    tickSpacing,
                    balance0,
                    balance1,
                    0, // amount0Min
                    0  // amount1Min
                );
            }
        }
    }

    /**
     * @notice Override withdrawAll for Shadow positions
     */
    function withdrawAll() external override onlyVault {
        address vault = _vault();
        
        // Exit position completely
        _exitPosition();
        
        // Get current balances
        uint256 balance0 = _tokenX().balanceOf(address(this));
        uint256 balance1 = _tokenY().balanceOf(address(this));
        
        // Get queued withdrawals info
        uint256 queuedShares = IBaseVault(vault).getCurrentTotalQueuedWithdrawal();
        
        // Calculate queued amounts (if any)
        uint256 totalSupply = IBaseVault(vault).totalSupply();
        uint256 queuedAmount0 = 0;
        uint256 queuedAmount1 = 0;
        
        if (totalSupply > 0 && queuedShares > 0) {
            queuedAmount0 = balance0 * queuedShares / totalSupply;
            queuedAmount1 = balance1 * queuedShares / totalSupply;
        }
        
        // Execute queued withdrawals
        _transferAndExecuteQueuedAmountsShadow(queuedShares, queuedAmount0, queuedAmount1);
        
        // Transfer remaining tokens to vault
        balance0 = _tokenX().balanceOf(address(this));
        balance1 = _tokenY().balanceOf(address(this));
        
        if (balance0 > 0) _tokenX().safeTransfer(vault, balance0);
        if (balance1 > 0) _tokenY().safeTransfer(vault, balance1);
        
        // Try to harvest any remaining rewards
        try this.harvestRewards() {} catch {}
    }

    /**
     * @notice Override to hide Metropolis range methods
     */
    function getRange() external view override returns (int32 lower, int32 upper) {
        // Direct conversion from int24 to int32
        return (int32(_currentTickLower), int32(_currentTickUpper));
    }

    /**
     * @notice Override _getBalances to calculate Shadow position value
     */
    function _getBalances() internal view override returns (uint256 amountX, uint256 amountY) {
        // Get idle balances
        amountX = _tokenX().balanceOf(address(this));
        amountY = _tokenY().balanceOf(address(this));
        
        // If we have a position, calculate its value
        if (_positionTokenId != 0) {
            INonfungiblePositionManager npm = getNonfungiblePositionManager();
            
            // Get position info
            (,,, int24 tickLower, int24 tickUpper, uint128 liquidity,,, uint128 tokensOwed0, uint128 tokensOwed1) = 
                npm.positions(_positionTokenId);
            
            if (liquidity > 0) {
                // Get the pool to query current tick
                address pool = _getPoolAddress();
                if (pool != address(0)) {
                    // Get current tick from pool
                    (, int24 currentTick,,,,,) = IRamsesV3Pool(pool).slot0();
                    
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
            }
            
            // Add tokens owed (uncollected fees)
            amountX += tokensOwed0;
            amountY += tokensOwed1;
        }
    }

    /**
     * @notice Override hasRewards to check Shadow gauge
     */
    function hasRewards() external view override returns (bool) {
        IMinimalVoter voter = getVoter();
        if (address(voter) == address(0)) return false;
        
        address pool = _getPoolAddress();
        if (pool == address(0)) return false;
        
        return voter.gaugeForPool(pool) != address(0);
    }

    /**
     * @notice Helper to transfer and execute queued amounts
     * @dev Duplicated from parent Strategy since it's private there
     */
    function _transferAndExecuteQueuedAmountsShadow(uint256 queuedShares, uint256 queuedAmountX, uint256 queuedAmountY)
        private
    {
        if (queuedShares > 0) {
            address vault = _vault();
            
            // Transfer the tokens to the vault and execute the queued withdrawals
            if (queuedAmountX > 0) _tokenX().safeTransfer(vault, queuedAmountX);
            if (queuedAmountY > 0) _tokenY().safeTransfer(vault, queuedAmountY);
            
            IBaseVault(vault).executeQueuedWithdrawals();
        }
    }
}
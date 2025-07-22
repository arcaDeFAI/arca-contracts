// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.26;
pragma abicoder v2;

import 'contracts/CL/core/libraries/SafeCast.sol';
import 'contracts/CL/core/libraries/TickMath.sol';
import 'contracts/CL/core/libraries/TickBitmap.sol';
import 'contracts/CL/core/interfaces/IRamsesV3Pool.sol';
import 'contracts/CL/core/interfaces/IRamsesV3Factory.sol';
import 'contracts/CL/core/interfaces/callback/IUniswapV3SwapCallback.sol';
import 'contracts/CL/periphery/libraries/Path.sol';
import 'contracts/CL/periphery/libraries/PoolAddress.sol';
import 'contracts/CL/periphery/libraries/CallbackValidation.sol';
import 'contracts/interfaces/IPair.sol';
import 'contracts/interfaces/IPairFactory.sol';
import 'contracts/CL/periphery/interfaces/IMixedRouteQuoterV1.sol';
import 'contracts/CL/periphery/libraries/PoolTicksCounter.sol';
import 'contracts/CL/universalRouter/modules/uniswap/v2/RamsesLegacyLibrary.sol';
/// @title Provides on chain quotes for V3, V2, and MixedRoute exact input swaps
/// @notice Allows getting the expected amount out for a given swap without executing the swap
/// @notice Does not support exact output swaps since using the contract balance between exactOut swaps is not supported
/// @dev These functions are not gas efficient and should _not_ be called on chain. Instead, optimistically execute
/// the swap and check the amounts in the callback.
contract MixedRouteQuoterV1 is IMixedRouteQuoterV1, IUniswapV3SwapCallback {
    using Path for bytes;
    using SafeCast for uint256;
    using PoolTicksCounter for IRamsesV3Pool;
    address public pairFactory;
    address public factory;
    address public contractDeployer;
    bytes32 public initCodeHash;
    /// @dev Value to bit mask with path fee to determine if V2 or V3 route
    // max V3 fee:           000011110100001001000000 (24 bits)
    // mask:       1 << 23 = 100000000000000000000000 = decimal value 8388608
    uint24 private constant flagBitmask = 8388608;

    /// @dev Transient storage variable used to check a safety condition in exact output swaps.
    uint256 private amountOutCached;

    constructor(address _factory, address _pairFactory) {
        factory = _factory;
        contractDeployer = IRamsesV3Factory(factory).ramsesV3PoolDeployer();
        pairFactory = _pairFactory;
        // initCodeHash = IPairFactory(_pairFactory).pairCodeHash();
        initCodeHash = 0x96e8ac4277198ff8b6f785478aa9a3453ee4fbe1945627f56725939b223ff5c2; // fake random hash
    }

    function getPool(address tokenA, address tokenB, int24 tickSpacing) private view returns (IRamsesV3Pool) {
        return IRamsesV3Pool(PoolAddress.computeAddress(contractDeployer, PoolAddress.getPoolKey(tokenA, tokenB, tickSpacing)));
    }

    /// @dev Given an amountIn, fetch the reserves of the V2 pair and get the amountOut
    function getPairAmountOut(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        bool stable
    ) private view returns (uint256) {
        address pair = RamsesLegacyLibrary.pairFor(pairFactory, initCodeHash, tokenIn, tokenOut, stable);
        uint256 fee = IPairFactory(pairFactory).pairFee(pair);
        (uint256 reserveIn, uint256 reserveOut, uint256 decimalsIn, uint256 decimalsOut) = RamsesLegacyLibrary.getReserves(
            pairFactory,
            initCodeHash,
            tokenIn,
            tokenOut,
            stable
        );

        amountIn -= (amountIn * fee) / 10000;
        return RamsesLegacyLibrary.getAmountOut(amountIn, reserveIn, reserveOut, stable, decimalsIn, decimalsOut);
    }

    /// @inheritdoc IUniswapV3SwapCallback
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes memory path) external view override {
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
        (address tokenIn, int24 tickSpacing, address tokenOut) = path.decodeFirstPool();
        CallbackValidation.verifyCallback(contractDeployer, tokenIn, tokenOut, tickSpacing);

        (bool isExactInput, uint256 amountReceived) = amount0Delta > 0
            ? (tokenIn < tokenOut, uint256(-amount1Delta))
            : (tokenOut < tokenIn, uint256(-amount0Delta));

        IRamsesV3Pool pool = getPool(tokenIn, tokenOut, tickSpacing);
        (uint160 v3SqrtPriceX96After, int24 tickAfter, , , , , ) = pool.slot0();

        if (isExactInput) {
            assembly {
                let ptr := mload(0x40)
                mstore(ptr, amountReceived)
                mstore(add(ptr, 0x20), v3SqrtPriceX96After)
                mstore(add(ptr, 0x40), tickAfter)
                revert(ptr, 0x60)
            }
        } else {
            /// since we don't support exactOutput, revert here
            revert('Exact output quote not supported');
        }
    }

    /// @dev Parses a revert reason that should contain the numeric quote
    function parseRevertReason(
        bytes memory reason
    ) private pure returns (uint256 amount, uint160 sqrtPriceX96After, int24 tickAfter) {
        if (reason.length != 0x60) {
            if (reason.length < 0x44) revert('Unexpected error');
            assembly {
                reason := add(reason, 0x04)
            }
            revert(abi.decode(reason, (string)));
        }
        return abi.decode(reason, (uint256, uint160, int24));
    }

    function handleV3Revert(
        bytes memory reason,
        IRamsesV3Pool pool,
        uint256 gasEstimate
    ) private view returns (uint256 amount, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256) {
        int24 tickBefore;
        int24 tickAfter;
        (, tickBefore, , , , , ) = pool.slot0();
        (amount, sqrtPriceX96After, tickAfter) = parseRevertReason(reason);

        initializedTicksCrossed = pool.countInitializedTicksCrossed(tickBefore, tickAfter);

        return (amount, sqrtPriceX96After, initializedTicksCrossed, gasEstimate);
    }

    /// @dev Fetch an exactIn quote for a V3 Pool on chain
    function quoteExactInputSingleV3(
        QuoteExactInputSingleV3Params memory params
    )
        public
        override
        returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)
    {
        bool zeroForOne = params.tokenIn < params.tokenOut;
        IRamsesV3Pool pool = getPool(params.tokenIn, params.tokenOut, params.tickSpacing);

        uint256 gasBefore = gasleft();
        try
            pool.swap(
                address(this), // address(0) might cause issues with some tokens
                zeroForOne,
                params.amountIn.toInt256(),
                params.sqrtPriceLimitX96 == 0
                    ? (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                    : params.sqrtPriceLimitX96,
                abi.encodePacked(params.tokenIn, params.tickSpacing, params.tokenOut)
            )
        {} catch (bytes memory reason) {
            gasEstimate = gasBefore - gasleft();
            return handleV3Revert(reason, pool, gasEstimate);
        }
    }

    /// @dev Fetch an exactIn quote for a V2 pair on chain
    function quoteExactInputSingleV2(
        QuoteExactInputSingleV2Params memory params
    ) public view override returns (uint256 amountOut) {
        amountOut = getPairAmountOut(params.amountIn, params.tokenIn, params.tokenOut, params.stable);
    }

    /// @dev Get the quote for an exactIn swap between an array of V2 and/or V3 pools
    /// @notice To encode a V2 pair within the path, use 0x800000 (hex value of 8388608) for the fee between the two token addresses
    function quoteExactInput(
        bytes memory path,
        uint256 amountIn
    )
        public
        override
        returns (
            uint256 amountOut,
            uint160[] memory v3SqrtPriceX96AfterList,
            uint32[] memory v3InitializedTicksCrossedList,
            uint256 v3SwapGasEstimate
        )
    {
        v3SqrtPriceX96AfterList = new uint160[](path.numPools());
        v3InitializedTicksCrossedList = new uint32[](path.numPools());

        uint256 i = 0;
        while (true) {
            (address tokenIn, int24 tickSpacing, address tokenOut) = path.decodeFirstPool();
            uint24 tickSpacingUint = uint24(tickSpacing);

            if (tickSpacingUint & flagBitmask != 0) {
                bool stable = tickSpacingUint == flagBitmask ? true : false;
                amountIn = quoteExactInputSingleV2(
                    QuoteExactInputSingleV2Params({tokenIn: tokenIn, tokenOut: tokenOut, amountIn: amountIn, stable: stable})
                );
            } else {
                /// the outputs of prior swaps become the inputs to subsequent ones
                (
                    uint256 _amountOut,
                    uint160 _sqrtPriceX96After,
                    uint32 _initializedTicksCrossed,
                    uint256 _gasEstimate
                ) = quoteExactInputSingleV3(
                        QuoteExactInputSingleV3Params({
                            tokenIn: tokenIn,
                            tokenOut: tokenOut,
                            tickSpacing: tickSpacing,
                            amountIn: amountIn,
                            sqrtPriceLimitX96: 0
                        })
                    );
                v3SqrtPriceX96AfterList[i] = _sqrtPriceX96After;
                v3InitializedTicksCrossedList[i] = _initializedTicksCrossed;
                v3SwapGasEstimate += _gasEstimate;
                amountIn = _amountOut;
            }
            i++;

            /// decide whether to continue or terminate
            if (path.hasMultiplePools()) {
                path = path.skipToken();
            } else {
                return (amountIn, v3SqrtPriceX96AfterList, v3InitializedTicksCrossedList, v3SwapGasEstimate);
            }
        }
    }
}
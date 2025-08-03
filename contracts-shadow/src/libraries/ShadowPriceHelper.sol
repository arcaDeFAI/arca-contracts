// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {IRamsesV3Pool} from "../../CL/core/interfaces/IRamsesV3Pool.sol";
import {TickMath} from "../../CL/core/libraries/TickMath.sol";
import {FullMath} from "../../CL/core/libraries/FullMath.sol";

/**
 * @title Shadow Price Helper Library
 * @notice Library for calculating spot and TWAP prices from Ramses V3 pools
 */
library ShadowPriceHelper {
    function getOraclePrice(
        IRamsesV3Pool pool,
        bool isTokenX,
        uint32 twapInterval,
        uint8 decimalsX,
        uint8 decimalsY
    ) external view returns (uint256) {
        if (twapInterval == 0) {
            return getPoolSpotPrice(pool, isTokenX, decimalsX, decimalsY);
        } else {
            return getPoolTWAPPrice(pool, isTokenX, twapInterval, decimalsX, decimalsY);
        }
    }
    
    function getPoolSpotPrice(
        IRamsesV3Pool pool,
        bool isTokenX,
        uint8 decimalsX,
        uint8 decimalsY
    ) internal view returns (uint256) {
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        
        // Use high precision scaling constant to avoid losing precision
        // This needs to be large enough to maintain precision for small prices
        uint256 PRECISION_SCALE = 1e36;
        
        // Calculate (sqrtPriceX96)^2 * PRECISION_SCALE / 2^192
        // This gives us the raw price (token1 per token0) scaled by PRECISION_SCALE
        uint256 priceScaled = FullMath.mulDiv(
            uint256(sqrtPriceX96) * uint256(sqrtPriceX96),
            PRECISION_SCALE,
            1 << 192
        );
        
        if (isTokenX) {
            // We want price of tokenX in terms of tokenY
            // Raw price is already token1/token0 (Y/X if X is token0)
            // Need to convert from "Y wei per X wei" to "Y per X"
            // This means multiplying by 10^decimalsX and dividing by PRECISION_SCALE
            return FullMath.mulDiv(priceScaled, 10 ** decimalsX, PRECISION_SCALE);
        } else {
            // We want price of tokenY in terms of tokenX
            // Raw price is token1/token0 (Y/X if X is token0)
            // We need to invert: X/Y = 1 / (Y/X)
            
            // First get the price of X in Y with proper decimals
            uint256 priceXInY = FullMath.mulDiv(priceScaled, 10 ** decimalsX, PRECISION_SCALE);
            
            // Now invert to get Y in X
            // If 1 X = priceXInY Y, then 1 Y = (10^decimalsX / priceXInY) X
            // But we need to scale properly: (10^decimalsX * 10^decimalsY) / priceXInY
            if (priceXInY == 0) return 0;
            
            return FullMath.mulDiv(10 ** decimalsY, 10 ** decimalsX, priceXInY);
        }
    }
    
    function getPoolTWAPPrice(
        IRamsesV3Pool pool,
        bool isTokenX,
        uint32 twapInterval,
        uint8 decimalsX,
        uint8 decimalsY
    ) internal view returns (uint256) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapInterval;
        secondsAgos[1] = 0;
        
        (int56[] memory tickCumulatives,) = pool.observe(secondsAgos);
        
        int24 avgTick = int24((tickCumulatives[1] - tickCumulatives[0]) / int56(uint56(twapInterval)));
        
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(avgTick);
        
        // Use the same high precision approach as spot price
        uint256 PRECISION_SCALE = 1e36;
        
        // Calculate (sqrtPriceX96)^2 * PRECISION_SCALE / 2^192
        uint256 priceScaled = FullMath.mulDiv(
            uint256(sqrtPriceX96) * uint256(sqrtPriceX96),
            PRECISION_SCALE,
            1 << 192
        );
        
        if (isTokenX) {
            // Price of tokenX in terms of tokenY
            return FullMath.mulDiv(priceScaled, 10 ** decimalsX, PRECISION_SCALE);
        } else {
            // Price of tokenY in terms of tokenX (inverted)
            uint256 priceXInY = FullMath.mulDiv(priceScaled, 10 ** decimalsX, PRECISION_SCALE);
            
            if (priceXInY == 0) return 0;
            
            return FullMath.mulDiv(10 ** decimalsY, 10 ** decimalsX, priceXInY);
        }
    }
}
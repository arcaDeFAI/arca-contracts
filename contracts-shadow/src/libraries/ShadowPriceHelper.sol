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
        
        if (isTokenX) {
            uint256 price = FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), 1 << 192);
            
            if (decimalsX > decimalsY) {
                return price * (10 ** (decimalsX - decimalsY));
            } else if (decimalsY > decimalsX) {
                return price / (10 ** (decimalsY - decimalsX));
            } else {
                return price;
            }
        } else {
            uint256 price = FullMath.mulDiv(1 << 192, 1e18, FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), 1));
            
            if (decimalsY > decimalsX) {
                return price * (10 ** (decimalsY - decimalsX));
            } else if (decimalsX > decimalsY) {
                return price / (10 ** (decimalsX - decimalsY));
            } else {
                return price;
            }
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
        
        if (isTokenX) {
            uint256 price = FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), 1 << 192);
            
            if (decimalsX > decimalsY) {
                return price * (10 ** (decimalsX - decimalsY));
            } else if (decimalsY > decimalsX) {
                return price / (10 ** (decimalsY - decimalsX));
            } else {
                return price;
            }
        } else {
            uint256 price = FullMath.mulDiv(1 << 192, 1e18, FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), 1));
            
            if (decimalsY > decimalsX) {
                return price * (10 ** (decimalsY - decimalsX));
            } else if (decimalsX > decimalsY) {
                return price / (10 ** (decimalsX - decimalsY));
            } else {
                return price;
            }
        }
    }
}
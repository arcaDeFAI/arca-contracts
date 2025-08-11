// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {IRamsesV3Pool} from "../CL/core/interfaces/IRamsesV3Pool.sol";
import {ShadowPriceHelper} from "./libraries/ShadowPriceHelper.sol";

/**
 * @title Shadow Price Helper Wrapper
 * @notice Wrapper contract to expose ShadowPriceHelper library functions as external view functions
 * @dev This contract makes it possible to call library functions from JavaScript/TypeScript
 */
contract ShadowPriceHelperWrapper {
    /**
     * @notice Get oracle price (spot or TWAP based on interval)
     * @param pool The Ramses V3 pool to get price from
     * @param isTokenX Whether to get price of tokenX in terms of tokenY
     * @param twapInterval TWAP interval in seconds (0 for spot price)
     * @param decimalsX Decimals of token X
     * @param decimalsY Decimals of token Y
     * @return price The calculated price
     */
    function getOraclePrice(
        IRamsesV3Pool pool,
        bool isTokenX,
        uint32 twapInterval,
        uint8 decimalsX,
        uint8 decimalsY
    ) external view returns (uint256) {
        return
            ShadowPriceHelper.getOraclePrice(
                pool,
                isTokenX,
                twapInterval,
                decimalsX,
                decimalsY
            );
    }

    /**
     * @notice Get current spot price from pool
     * @param pool The Ramses V3 pool to get price from
     * @param isTokenX Whether to get price of tokenX in terms of tokenY
     * @param decimalsX Decimals of token X
     * @param decimalsY Decimals of token Y
     * @return price The spot price
     */
    function getPoolSpotPrice(
        IRamsesV3Pool pool,
        bool isTokenX,
        uint8 decimalsX,
        uint8 decimalsY
    ) external view returns (uint256) {
        return
            ShadowPriceHelper.getPoolSpotPrice(
                pool,
                isTokenX,
                decimalsX,
                decimalsY
            );
    }

    /**
     * @notice Get TWAP price from pool
     * @param pool The Ramses V3 pool to get price from
     * @param isTokenX Whether to get price of tokenX in terms of tokenY
     * @param twapInterval TWAP interval in seconds
     * @param decimalsX Decimals of token X
     * @param decimalsY Decimals of token Y
     * @return price The TWAP price
     */
    function getPoolTWAPPrice(
        IRamsesV3Pool pool,
        bool isTokenX,
        uint32 twapInterval,
        uint8 decimalsX,
        uint8 decimalsY
    ) external view returns (uint256) {
        return
            ShadowPriceHelper.getPoolTWAPPrice(
                pool,
                isTokenX,
                twapInterval,
                decimalsX,
                decimalsY
            );
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {ILBPair} from "@arca/joe-v2/interfaces/ILBPair.sol";
import {Uint256x256Math} from "@arca/joe-v2/libraries/math/Uint256x256Math.sol";

/**
 * @title Metropolis Price Helper Library
 * @notice Library for calculating spot and TWAP prices from LB pairs
 * @dev Returns prices in 128.128 binary fixed-point format (Y wei per X wei).
 * This format inherently handles different token decimals without conversion.
 */
library MetropolisPriceHelper {
    using Uint256x256Math for uint256;

    uint8 private constant _PRICE_OFFSET = 128;

    error MetropolisPriceHelper__InvalidPrice();
    error MetropolisPriceHelper__PriceDeviation();
    error MetropolisPriceHelper__InvalidTimestamps();

    /**
     * @notice Returns the price of tokenX in tokenY (128.128 fixed-point).
     * Uses spot price if twapInterval is 0, otherwise TWAP.
     * @param pair The LB pair contract
     * @param twapInterval The TWAP interval in seconds (0 for spot)
     * @return price The price in 128.128 format
     */
    function getPrice(
        ILBPair pair,
        uint32 twapInterval
    ) internal view returns (uint256 price) {
        if (twapInterval == 0) {
            price = getSpotPrice(pair);
        } else {
            price = getTWAPPrice(pair, twapInterval);
        }
        if (price == 0) revert MetropolisPriceHelper__InvalidPrice();
    }

    /**
     * @notice Returns the current spot price from the LB pair's active bin.
     * @param pair The LB pair contract
     * @return price The spot price in 128.128 format
     */
    function getSpotPrice(
        ILBPair pair
    ) internal view returns (uint256 price) {
        uint24 activeId = pair.getActiveId();
        price = pair.getPriceFromId(activeId);
    }

    /**
     * @notice Returns the TWAP price from the LB pair's oracle.
     * @param pair The LB pair contract
     * @param twapInterval The TWAP interval in seconds
     * @return price The TWAP price in 128.128 format
     */
    function getTWAPPrice(
        ILBPair pair,
        uint32 twapInterval
    ) internal view returns (uint256 price) {
        uint40 twapStart = uint40(block.timestamp - twapInterval);
        uint40 twapEnd = uint40(block.timestamp);

        if (twapEnd <= twapStart)
            revert MetropolisPriceHelper__InvalidTimestamps();

        (uint64 cumulativeId1, , ) = pair.getOracleSampleAt(twapStart);
        (uint64 cumulativeId2, , ) = pair.getOracleSampleAt(twapEnd);

        uint40 timeElapsed = twapEnd - twapStart;
        uint24 avgBinId = uint24(
            (cumulativeId2 - cumulativeId1) / timeElapsed
        );
        price = pair.getPriceFromId(avgBinId);
    }

    /**
     * @notice Checks that the spot price does not deviate from TWAP beyond threshold.
     * @dev Reverts with MetropolisPriceHelper__PriceDeviation if deviation exceeds threshold.
     * No-op if twapInterval is 0 or threshold is 0.
     * @param pair The LB pair contract
     * @param twapInterval The TWAP interval in seconds
     * @param deviationThreshold The maximum allowed deviation percentage (e.g., 5 = 5%)
     */
    function checkPriceDeviation(
        ILBPair pair,
        uint32 twapInterval,
        uint256 deviationThreshold
    ) internal view {
        if (twapInterval == 0 || deviationThreshold == 0) return;

        uint256 spotPrice = getSpotPrice(pair);
        uint256 twapPrice = getTWAPPrice(pair, twapInterval);

        if (
            spotPrice >
            (twapPrice * (100 + deviationThreshold)) / 100 ||
            spotPrice <
            (twapPrice * (100 - deviationThreshold)) / 100
        ) {
            revert MetropolisPriceHelper__PriceDeviation();
        }
    }

    /**
     * @notice Converts amounts of tokenX and tokenY to a total value in tokenY.
     * @param price128 The price of tokenX in tokenY (128.128 format)
     * @param amountX The amount of token X in wei
     * @param amountY The amount of token Y in wei
     * @return valueInY The total value in token Y wei
     */
    function getValueInY(
        uint256 price128,
        uint256 amountX,
        uint256 amountY
    ) internal pure returns (uint256 valueInY) {
        uint256 amountXInY = price128.mulShiftRoundDown(
            amountX,
            _PRICE_OFFSET
        );
        valueInY = amountXInY + amountY;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ILBPair} from "@arca/joe-v2/interfaces/ILBPair.sol";
import {MetropolisPriceHelper} from "../../contracts-metropolis/src/libraries/MetropolisPriceHelper.sol";

/**
 * @title TestOracleVault
 * @dev Simplified test contract that exposes OracleVault previewShares logic
 * using MetropolisPriceHelper (reads price from LB pair directly).
 */
contract TestOracleVault {
    ILBPair private _pair;
    uint32 private _twapInterval;
    uint256 private _deviationThreshold;
    uint256 private _totalSupply;
    uint256 private _totalBalanceX;
    uint256 private _totalBalanceY;

    uint256 internal constant _SHARES_PRECISION = 10 ** 6;

    constructor(address pair) {
        _pair = ILBPair(pair);
    }

    function setTotalSupply(uint256 totalSupply) external {
        _totalSupply = totalSupply;
    }

    function setTotalBalances(
        uint256 totalBalanceX,
        uint256 totalBalanceY
    ) external {
        _totalBalanceX = totalBalanceX;
        _totalBalanceY = totalBalanceY;
    }

    function setTwapInterval(uint32 twapInterval) external {
        _twapInterval = twapInterval;
    }

    function setDeviationThreshold(uint256 threshold) external {
        _deviationThreshold = threshold;
    }

    /**
     * @dev Implementation of previewShares logic matching OracleVault._previewShares
     */
    function previewShares(
        uint256 amountX,
        uint256 amountY
    )
        external
        view
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY)
    {
        if (amountX == 0 && amountY == 0) {
            return (0, 0, 0);
        }

        uint256 price = MetropolisPriceHelper.getPrice(_pair, _twapInterval);

        MetropolisPriceHelper.checkPriceDeviation(
            _pair,
            _twapInterval,
            _deviationThreshold
        );

        uint256 valueInY = MetropolisPriceHelper.getValueInY(
            price,
            amountX,
            amountY
        );

        if (_totalSupply == 0) {
            shares = valueInY * _SHARES_PRECISION;
        } else {
            uint256 totalValueInY = MetropolisPriceHelper.getValueInY(
                price,
                _totalBalanceX,
                _totalBalanceY
            );

            if (totalValueInY == 0) {
                revert("Division by zero: total value is zero");
            }

            shares = (valueInY * _totalSupply) / totalValueInY;
        }

        effectiveX = amountX;
        effectiveY = amountY;
    }

    function getPrice() external view returns (uint256) {
        return MetropolisPriceHelper.getPrice(_pair, _twapInterval);
    }

    function getSpotPrice() external view returns (uint256) {
        return MetropolisPriceHelper.getSpotPrice(_pair);
    }

    function getValueInY(
        uint256 amountX,
        uint256 amountY
    ) external view returns (uint256) {
        uint256 price = MetropolisPriceHelper.getPrice(_pair, _twapInterval);
        return MetropolisPriceHelper.getValueInY(price, amountX, amountY);
    }

    function getTotalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function getTotalBalances() external view returns (uint256, uint256) {
        return (_totalBalanceX, _totalBalanceY);
    }
}

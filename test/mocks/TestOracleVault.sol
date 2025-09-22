// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {
    IOracleHelper
} from "../../contracts-metropolis/src/interfaces/IOracleHelper.sol";

/**
 * @title TestOracleVault
 * @dev Simplified test contract that exposes OracleVault previewShares logic
 */
contract TestOracleVault {
    IOracleHelper private _oracleHelper;
    uint256 private _totalSupply;
    uint256 private _totalBalanceX;
    uint256 private _totalBalanceY;

    uint256 internal constant _SHARES_PRECISION = 10 ** 6;

    constructor(address oracleHelper) {
        _oracleHelper = IOracleHelper(oracleHelper);
    }

    // Mock functions to set vault state for testing
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

    /**
     * @dev Implementation of previewShares logic from OracleVault
     * This follows the same logic as the actual _previewShares function
     */
    function previewShares(
        uint256 amountX,
        uint256 amountY
    )
        external
        view
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY)
    {
        // Return zero if no amounts
        if (amountX == 0 && amountY == 0) {
            return (0, 0, 0);
        }

        // Check price deviation first (this would revert in real contract if out of bounds)
        if (!_oracleHelper.checkPriceInDeviation()) {
            revert("Price out of deviation");
        }

        // Get current price from oracle
        uint256 price = _oracleHelper.getPrice();

        // Calculate total value in Y using oracle helper
        uint256 valueInY = _oracleHelper.getValueInY(price, amountX, amountY);

        if (_totalSupply == 0) {
            // First deposit formula: shares = valueInY * SHARES_PRECISION
            shares = valueInY * _SHARES_PRECISION;
        } else {
            // Get current total value of the vault
            uint256 totalValueInY = _oracleHelper.getValueInY(
                price,
                _totalBalanceX,
                _totalBalanceY
            );

            if (totalValueInY == 0) {
                revert("Division by zero: total value is zero");
            }

            // Subsequent deposits: shares = valueInY * totalShares / totalValueInY
            shares = (valueInY * _totalSupply) / totalValueInY;
        }

        // For this test, we assume full amounts are effective
        effectiveX = amountX;
        effectiveY = amountY;
    }

    // Getter functions for testing
    function getTotalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function getTotalBalances() external view returns (uint256, uint256) {
        return (_totalBalanceX, _totalBalanceY);
    }

    function getOracleHelper() external view returns (IOracleHelper) {
        return _oracleHelper;
    }
}

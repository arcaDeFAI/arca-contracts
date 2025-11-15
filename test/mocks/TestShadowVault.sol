// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title TestShadowVault
 * @dev Simplified test contract that exposes Shadow vault previewShares logic
 */
contract TestShadowVault {
    address private _pool;
    uint256 private _totalSupply;
    uint256 private _totalBalanceX;
    uint256 private _totalBalanceY;
    uint8 private _decimalsX;
    uint8 private _decimalsY;

    uint256 internal constant _SHARES_PRECISION = 10 ** 6;

    constructor(address pool, uint8 decimalsX, uint8 decimalsY) {
        _pool = pool;
        _decimalsX = decimalsX;
        _decimalsY = decimalsY;
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
     * @dev Simplified previewShares logic for Shadow vaults
     * This is a simplified version that uses a mock price calculation
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

        // Get pool price (simplified mock calculation)
        uint256 priceXinY = _getMockPoolPrice();

        // Calculate value in Y using Shadow vault logic: valueInY = (priceXinY * amountX) + amountY
        uint256 valueInY = _calculateValueInY(priceXinY, amountX, amountY);

        if (_totalSupply == 0) {
            // First deposit formula: shares = valueInY * SHARES_PRECISION
            shares = valueInY * _SHARES_PRECISION;
        } else {
            // Get current total value of the vault
            uint256 totalValueInY = _calculateValueInY(
                priceXinY,
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

    /**
     * @dev Mock pool price calculation
     * In the real Shadow vault, this would read from the Ramses V3 pool
     */
    function _getMockPoolPrice() internal pure returns (uint256) {
        // Return mock price: 2000 USDC per ETH (scaled for decimals)
        return 2000 * 10 ** 6; // 2000e6
    }

    /**
     * @dev Calculate value in Y tokens using Shadow vault logic
     */
    function _calculateValueInY(
        uint256 priceXinY,
        uint256 amountX,
        uint256 amountY
    ) internal view returns (uint256) {
        // Convert X amount to Y value using price
        uint256 amountXInY = (amountX * priceXinY) / (10 ** _decimalsX);
        return amountXInY + amountY;
    }

    // Getter functions for testing
    function getTotalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function getTotalBalances() external view returns (uint256, uint256) {
        return (_totalBalanceX, _totalBalanceY);
    }

    function getPool() external view returns (address) {
        return _pool;
    }
}

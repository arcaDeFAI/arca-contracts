// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title TestVaultShadow
 * @dev Simplified test contract exposing Shadow vault previewShares logic
 */
contract TestVaultShadow {
    uint256 internal constant _SHARES_PRECISION = 10 ** 6;

    // Vault state
    uint256 public totalSupply;
    uint256 public totalBalanceX;
    uint256 public totalBalanceY;

    // Mock price (2000 USDC per ETH)
    uint256 private constant MOCK_PRICE = 2000e6;

    // Setters for test state
    function setTotalSupply(uint256 _totalSupply) external {
        totalSupply = _totalSupply;
    }

    function setTotalBalances(
        uint256 _totalBalanceX,
        uint256 _totalBalanceY
    ) external {
        totalBalanceX = _totalBalanceX;
        totalBalanceY = _totalBalanceY;
    }

    /**
     * @dev Implementation matching Shadow vault _previewShares
     */
    function previewShares(
        uint256 amountX,
        uint256 amountY
    )
        external
        view
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY)
    {
        if (amountX == 0 && amountY == 0) return (0, 0, 0);

        uint256 amountXinY = _calculateAmountInOtherToken(amountX, true);
        uint256 valueInY = amountXinY + amountY;

        if (totalSupply == 0) {
            return (valueInY * _SHARES_PRECISION, amountX, amountY);
        }

        require(totalBalanceX != 0 || totalBalanceY != 0, "Zero amount");

        uint256 totalXinY = _calculateAmountInOtherToken(totalBalanceX, true);
        uint256 totalValueInY = totalXinY + totalBalanceY;
        shares = (valueInY * totalSupply) / totalValueInY;

        return (shares, amountX, amountY);
    }

    /**
     * @dev Mock implementation of _calculateAmountInOtherToken
     * In real Shadow vault, this reads from Ramses V3 pool
     */
    function _calculateAmountInOtherToken(
        uint256 amount,
        bool isTokenX
    ) internal pure returns (uint256) {
        if (amount == 0) return 0;

        if (isTokenX) {
            // Convert X (ETH) to Y (USDC): amount * price / 1e18
            return (amount * MOCK_PRICE) / 1e18;
        } else {
            // Convert Y (USDC) to X (ETH): amount * 1e18 / price
            return (amount * 1e18) / MOCK_PRICE;
        }
    }
}

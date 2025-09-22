// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title TestVaultMetropolis
 * @dev Simplified test contract exposing OracleVault previewShares logic
 */
contract TestVaultMetropolis {
    uint256 internal constant _SHARES_PRECISION = 10 ** 6;

    // Mock oracle helper
    MockOracleHelper public oracleHelper;

    // Vault state
    uint256 public totalSupply;
    uint256 public totalBalanceX;
    uint256 public totalBalanceY;

    constructor() {
        oracleHelper = new MockOracleHelper(2000e6); // 2000 USDC per ETH
    }

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
     * @dev Implementation matching OracleVault._previewShares
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

        // Check price deviation (would revert in real contract)
        require(oracleHelper.checkPriceInDeviation(), "Price out of deviation");

        uint256 price = oracleHelper.getPrice();
        uint256 valueInY = oracleHelper.getValueInY(price, amountX, amountY);

        if (totalSupply == 0) {
            return (valueInY * _SHARES_PRECISION, amountX, amountY);
        }

        uint256 totalValueInY = oracleHelper.getValueInY(
            price,
            totalBalanceX,
            totalBalanceY
        );
        shares = (valueInY * totalSupply) / totalValueInY;

        return (shares, amountX, amountY);
    }
}

/**
 * @title MockOracleHelper
 * @dev Minimal mock for testing
 */
contract MockOracleHelper {
    uint256 private price;
    bool private priceInDeviation = true;

    constructor(uint256 _price) {
        price = _price;
    }

    function getPrice() external view returns (uint256) {
        return price;
    }

    function checkPriceInDeviation() external view returns (bool) {
        return priceInDeviation;
    }

    function getValueInY(
        uint256 _price,
        uint256 amountX,
        uint256 amountY
    ) external pure returns (uint256 valueInY) {
        // Convert X to Y value: (amountX * price) / 1e18 + amountY
        uint256 amountXInY = (amountX * _price) / 1e18;
        return amountXInY + amountY;
    }

    // Test helpers
    function setPrice(uint256 _price) external {
        price = _price;
    }

    function setPriceInDeviation(bool _inDeviation) external {
        priceInDeviation = _inDeviation;
    }
}

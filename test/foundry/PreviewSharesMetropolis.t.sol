// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {TestVaultMetropolis} from "./helpers/TestVaultMetropolis.sol";

/**
 * @title PreviewSharesMetropolis Test
 * @dev Foundry tests for OracleVault previewShares function
 */
contract PreviewSharesMetropolisTest is Test {
    TestVaultMetropolis vault;

    uint256 constant SHARES_PRECISION = 10 ** 6;
    uint256 constant ETH_AMOUNT = 1 ether; // 1 ETH
    uint256 constant USDC_AMOUNT = 500 * 10 ** 6; // 500 USDC
    uint256 constant PRICE = 2000 * 10 ** 6; // 2000 USDC per ETH

    function setUp() public {
        vault = new TestVaultMetropolis();
    }

    function testPreviewShares_ZeroAmounts() public view {
        (uint256 shares, uint256 effectiveX, uint256 effectiveY) = vault
            .previewShares(0, 0);

        assertEq(shares, 0, "Shares should be 0 for zero amounts");
        assertEq(effectiveX, 0, "EffectiveX should be 0");
        assertEq(effectiveY, 0, "EffectiveY should be 0");
    }

    function testPreviewShares_FirstDeposit() public {
        // Ensure total supply is 0
        vault.setTotalSupply(0);

        (uint256 shares, uint256 effectiveX, uint256 effectiveY) = vault
            .previewShares(ETH_AMOUNT, USDC_AMOUNT);

        // Expected: (1 ETH * 2000 USDC/ETH + 500 USDC) * 1e6 = 2500e6 * 1e6 = 2500e12
        uint256 expectedShares = 2500 * 10 ** 12;

        assertEq(
            shares,
            expectedShares,
            "First deposit shares calculation incorrect"
        );
        assertEq(effectiveX, ETH_AMOUNT, "EffectiveX should match input");
        assertEq(effectiveY, USDC_AMOUNT, "EffectiveY should match input");
    }

    function testPreviewShares_XOnlyDeposit() public {
        vault.setTotalSupply(0);

        (uint256 shares, uint256 effectiveX, uint256 effectiveY) = vault
            .previewShares(ETH_AMOUNT, 0);

        // Expected: (1 ETH * 2000 USDC/ETH) * 1e6 = 2000e6 * 1e6 = 2000e12
        uint256 expectedShares = 2000 * 10 ** 12;

        assertEq(shares, expectedShares, "X-only deposit shares incorrect");
        assertEq(effectiveX, ETH_AMOUNT, "EffectiveX should match input");
        assertEq(effectiveY, 0, "EffectiveY should be 0");
    }

    function testPreviewShares_YOnlyDeposit() public {
        vault.setTotalSupply(0);

        (uint256 shares, uint256 effectiveX, uint256 effectiveY) = vault
            .previewShares(0, USDC_AMOUNT);

        // Expected: 500 USDC * 1e6 = 500e6 * 1e6 = 500e12
        uint256 expectedShares = USDC_AMOUNT * SHARES_PRECISION;

        assertEq(shares, expectedShares, "Y-only deposit shares incorrect");
        assertEq(effectiveX, 0, "EffectiveX should be 0");
        assertEq(effectiveY, USDC_AMOUNT, "EffectiveY should match input");
    }

    function testPreviewShares_SubsequentDeposit() public {
        // Set up existing vault state
        uint256 totalShares = 5000 * 10 ** 6; // 5000 shares
        uint256 totalBalanceX = 2 ether; // 2 ETH
        uint256 totalBalanceY = 2000 * 10 ** 6; // 2000 USDC

        vault.setTotalSupply(totalShares);
        vault.setTotalBalances(totalBalanceX, totalBalanceY);

        // New deposit: 1 ETH + 500 USDC
        (uint256 shares, uint256 effectiveX, uint256 effectiveY) = vault
            .previewShares(ETH_AMOUNT, USDC_AMOUNT);

        // Total vault value = (2 ETH * 2000) + 2000 USDC = 6000 USDC
        // Deposit value = (1 ETH * 2000) + 500 USDC = 2500 USDC
        // Expected shares = 2500 * 5000 / 6000 = 2083333333 (with rounding)
        uint256 expectedShares = (2500 * 10 ** 6 * totalShares) /
            (6000 * 10 ** 6);

        assertEq(shares, expectedShares, "Subsequent deposit shares incorrect");
        assertEq(effectiveX, ETH_AMOUNT, "EffectiveX should match input");
        assertEq(effectiveY, USDC_AMOUNT, "EffectiveY should match input");
    }

    function testPreviewShares_LargeAmounts() public {
        vault.setTotalSupply(0);

        uint256 largeEthAmount = 1000 ether; // 1000 ETH
        uint256 largeUsdcAmount = 500000 * 10 ** 6; // 500k USDC

        (uint256 shares, , ) = vault.previewShares(
            largeEthAmount,
            largeUsdcAmount
        );

        // Expected: (1000 ETH * 2000 + 500k) * 1e6 = 2500k * 1e6 = 2.5e15
        uint256 expectedShares = 2500000 * 10 ** 12;

        assertEq(shares, expectedShares, "Large amounts calculation incorrect");
    }

    function testPreviewShares_SmallAmounts() public {
        vault.setTotalSupply(0);

        uint256 smallEthAmount = 1; // 1 wei
        uint256 smallUsdcAmount = 1; // 1 smallest USDC unit

        (uint256 shares, , ) = vault.previewShares(
            smallEthAmount,
            smallUsdcAmount
        );

        // Should handle small amounts without reverting
        assertGt(shares, 0, "Small amounts should still produce shares");
    }

    function testPreviewShares_PriceDeviationFailure() public {
        // Set price out of deviation
        vault.oracleHelper().setPriceInDeviation(false);

        vm.expectRevert("Price out of deviation");
        vault.previewShares(ETH_AMOUNT, USDC_AMOUNT);
    }

    function testPreviewShares_DifferentPrices() public {
        vault.setTotalSupply(0);

        // Test with different price
        vault.oracleHelper().setPrice(3000 * 10 ** 6); // 3000 USDC per ETH

        (uint256 shares, , ) = vault.previewShares(ETH_AMOUNT, USDC_AMOUNT);

        // Expected: (1 ETH * 3000 + 500) * 1e6 = 3500 * 1e6 = 3500e12
        uint256 expectedShares = 3500 * 10 ** 12;

        assertEq(
            shares,
            expectedShares,
            "Different price calculation incorrect"
        );
    }

    function testPreviewShares_ZeroDivisionProtection() public {
        // Set up scenario where totalValueInY would be 0
        vault.setTotalSupply(1000 * 10 ** 6); // Non-zero total supply
        vault.setTotalBalances(0, 0); // Zero balances

        // This should revert due to division by zero in totalValueInY calculation
        vm.expectRevert();
        vault.previewShares(ETH_AMOUNT, USDC_AMOUNT);
    }
}

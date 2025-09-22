// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {TestVaultShadow} from "./helpers/TestVaultShadow.sol";

/**
 * @title PreviewSharesShadow Test
 * @dev Foundry tests for Shadow vault previewShares function
 */
contract PreviewSharesShadowTest is Test {
    TestVaultShadow vault;

    uint256 constant SHARES_PRECISION = 10 ** 6;
    uint256 constant ETH_AMOUNT = 1 ether; // 1 ETH
    uint256 constant USDC_AMOUNT = 500 * 10 ** 6; // 500 USDC
    uint256 constant PRICE = 2000 * 10 ** 6; // 2000 USDC per ETH (hardcoded in contract)

    function setUp() public {
        vault = new TestVaultShadow();
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
        uint256 totalShares = 4000 * 10 ** 6; // 4000 shares
        uint256 totalBalanceX = 1.5 ether; // 1.5 ETH
        uint256 totalBalanceY = 1000 * 10 ** 6; // 1000 USDC

        vault.setTotalSupply(totalShares);
        vault.setTotalBalances(totalBalanceX, totalBalanceY);

        // New deposit: 0.5 ETH + 500 USDC
        uint256 depositX = 0.5 ether;
        uint256 depositY = USDC_AMOUNT;

        (uint256 shares, uint256 effectiveX, uint256 effectiveY) = vault
            .previewShares(depositX, depositY);

        // Total vault value = (1.5 ETH * 2000) + 1000 USDC = 4000 USDC
        // Deposit value = (0.5 ETH * 2000) + 500 USDC = 1500 USDC
        // Expected shares = 1500 * 4000 / 4000 = 1500
        uint256 expectedShares = 1500 * 10 ** 6;

        assertEq(shares, expectedShares, "Subsequent deposit shares incorrect");
        assertEq(effectiveX, depositX, "EffectiveX should match input");
        assertEq(effectiveY, depositY, "EffectiveY should match input");
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

    function testPreviewShares_ZeroBalanceRevert() public {
        // Set up scenario where totalBalanceX and totalBalanceY are both 0
        // but totalSupply > 0 (invalid state)
        vault.setTotalSupply(1000 * 10 ** 6); // Non-zero total supply
        vault.setTotalBalances(0, 0); // Zero balances

        // This should revert with "Zero amount"
        vm.expectRevert("Zero amount");
        vault.previewShares(ETH_AMOUNT, USDC_AMOUNT);
    }

    function testPreviewShares_ProportionalShares() public {
        // Test that proportional deposits give proportional shares
        vault.setTotalSupply(0);

        // First deposit: 1 ETH + 500 USDC
        (uint256 shares1, , ) = vault.previewShares(ETH_AMOUNT, USDC_AMOUNT);

        // Double deposit: 2 ETH + 1000 USDC
        (uint256 shares2, , ) = vault.previewShares(
            2 * ETH_AMOUNT,
            2 * USDC_AMOUNT
        );

        assertEq(
            shares2,
            2 * shares1,
            "Double deposit should give double shares"
        );
    }

    function testPreviewShares_ConsistencyWithMetropolis() public {
        // Both vault types should give same result for first deposit with same price
        vault.setTotalSupply(0);

        (uint256 shares, uint256 effectiveX, uint256 effectiveY) = vault
            .previewShares(ETH_AMOUNT, USDC_AMOUNT);

        // Should match Metropolis vault result: 2500e12 shares
        uint256 expectedShares = 2500 * 10 ** 12;

        assertEq(shares, expectedShares, "Should match Metropolis calculation");
        assertEq(effectiveX, ETH_AMOUNT, "EffectiveX should match");
        assertEq(effectiveY, USDC_AMOUNT, "EffectiveY should match");
    }

    function testPreviewShares_EdgeCaseRounding() public {
        // Test rounding behavior with odd numbers
        vault.setTotalSupply(3333 * 10 ** 6); // 3333 shares
        vault.setTotalBalances(1 ether, 999 * 10 ** 6); // Odd balance

        uint256 oddEthAmount = 1.333 ether;
        uint256 oddUsdcAmount = 333 * 10 ** 6;

        (uint256 shares, , ) = vault.previewShares(oddEthAmount, oddUsdcAmount);

        // Should not revert and should produce reasonable result
        assertGt(shares, 0, "Should produce valid shares for odd amounts");
    }
}

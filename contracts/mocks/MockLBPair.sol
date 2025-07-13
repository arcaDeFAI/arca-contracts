// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockLBPair {
    uint24 private activeId = 8388608; // Mock active ID (2^23)
    uint16 private binStep = 25; // Mock bin step (0.25%)
    IERC20 private tokenX;
    IERC20 private tokenY;
    uint128 private reserveX;
    uint128 private reserveY;
    
    // Mock price storage
    mapping(uint24 => uint256) private binPrices;

    // Mock liquidity tracking
    mapping(address => mapping(uint256 => uint256)) private userLiquidity;
    mapping(uint256 => uint256) private totalLiquidity;

    function initialize(
        IERC20 _tokenX,
        IERC20 _tokenY,
        uint16 _binStep
    ) external {
        tokenX = _tokenX;
        tokenY = _tokenY;
        binStep = _binStep;
    }

    function getActiveId() external view returns (uint24) {
        return activeId;
    }

    function setActiveId(uint24 _activeId) external {
        activeId = _activeId;
    }

    function getBinStep() external view returns (uint16) {
        return binStep;
    }

    function getTokenX() external view returns (IERC20) {
        return tokenX;
    }

    function getTokenY() external view returns (IERC20) {
        return tokenY;
    }

    function getPriceFromId(uint24 id) external view returns (uint256) {
        // Return stored price or default to 1.0 in 128.128 fixed point
        uint256 storedPrice = binPrices[id];
        if (storedPrice == 0) {
            return 2 ** 128; // 1.0 in 128.128 fixed point as default
        }
        return storedPrice;
    }
    
    // Helper function to set custom prices for testing
    function setPrice(uint24 id, uint256 price) external {
        binPrices[id] = price;
    }
    
    // Helper function to set tokens for testing
    function setTokens(IERC20 _tokenX, IERC20 _tokenY) external {
        tokenX = _tokenX;
        tokenY = _tokenY;
    }

    function getReserves() external view returns (uint128, uint128) {
        return (reserveX, reserveY);
    }

    function getLBHooksParameters() external pure returns (bytes32) {
        // Return mock hooks parameters
        return bytes32(0);
    }

    // Mock mint function that simulates adding liquidity
    function mint(
        address to,
        bytes32[] calldata liquidityConfigs,
        address refundTo
    )
        external
        returns (
            bytes32 amountsReceived,
            bytes32 amountsLeft,
            uint256[] memory liquidityMinted
        )
    {
        // For simplicity in testing, we'll just track some mock liquidity
        uint256 totalAmountX;
        uint256 totalAmountY;

        liquidityMinted = new uint256[](liquidityConfigs.length);

        for (uint256 i = 0; i < liquidityConfigs.length; i++) {
            // In a real implementation, liquidityConfigs would be decoded
            // For mock, we'll just create some liquidity
            uint256 mockLiquidity = 1000 * (i + 1);
            liquidityMinted[i] = mockLiquidity;
            userLiquidity[to][activeId + uint24(i)] += mockLiquidity;
            totalLiquidity[activeId + uint24(i)] += mockLiquidity;
        }

        // Mock amounts - in reality these would come from the liquidity configs
        totalAmountX = 1000 * liquidityConfigs.length;
        totalAmountY = 1000 * liquidityConfigs.length;

        // Update reserves
        reserveX += uint128(totalAmountX);
        reserveY += uint128(totalAmountY);

        // Pack amounts into bytes32 (first 128 bits for X, last 128 bits for Y)
        amountsReceived = bytes32(
            (uint256(totalAmountX) << 128) | totalAmountY
        );
        amountsLeft = bytes32(0); // No amounts left in mock

        return (amountsReceived, amountsLeft, liquidityMinted);
    }

    // Mock burn function that simulates removing liquidity
    function burn(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amountsToBurn
    ) external returns (bytes32[] memory amounts) {
        amounts = new bytes32[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            uint256 burnAmount = amountsToBurn[i];

            // Update liquidity tracking
            userLiquidity[from][id] -= burnAmount;
            totalLiquidity[id] -= burnAmount;

            // Mock amounts returned (simplified)
            uint256 amountX = burnAmount / 2;
            uint256 amountY = burnAmount / 2;

            // Update reserves
            if (reserveX >= amountX) reserveX -= uint128(amountX);
            if (reserveY >= amountY) reserveY -= uint128(amountY);

            // Pack amounts into bytes32
            amounts[i] = bytes32((uint256(amountX) << 128) | amountY);
        }

        return amounts;
    }

    // Mock function to check user liquidity
    function balanceOf(
        address account,
        uint256 id
    ) external view returns (uint256) {
        return userLiquidity[account][id];
    }

    // Mock function to get total supply of a bin
    function totalSupply(uint256 id) external view returns (uint256) {
        return totalLiquidity[id];
    }
}

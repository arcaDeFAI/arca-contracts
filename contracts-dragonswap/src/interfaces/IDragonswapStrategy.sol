// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {IStrategyCommon} from "../../../contracts-metropolis/src/interfaces/IStrategyCommon.sol";
import {INonfungiblePositionManager} from "../../CL/periphery/interfaces/INonfungiblePositionManager.sol";

/**
 * @title Dragonswap Strategy Interface
 * @author Arca
 * @notice Interface for Dragonswap-specific strategy functionality
 */
interface IDragonswapStrategy is IStrategyCommon {
    // Dragonswap-specific events
    event PositionMinted(
        uint256 indexed tokenId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    );
    event PositionBurned(uint256 indexed tokenId);

    // Dragonswap-specific getters
    function getPosition()
        external
        view
        returns (uint256 tokenId, int24 tickLower, int24 tickUpper);
    function getDragonswapNonfungiblePositionManager()
        external
        view
        returns (INonfungiblePositionManager);
    function getPool() external pure returns (address);
    function getRange() external view returns (int24 low, int24 upper);
    function getNpmLiquidity()
        external
        view
        returns (uint128 liquidity, uint128 tokensOwed0, uint128 tokensOwed1);

    // Dragonswap-specific rebalance - clean interface without unused parameters
    function rebalance(
        int24 tickLower,
        int24 tickUpper,
        int24 desiredTick,
        int24 slippageTick,
        uint256 amountX,
        uint256 amountY
    ) external;
}

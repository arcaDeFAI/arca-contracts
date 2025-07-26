// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {IStrategyCommon} from "../../../contracts-metropolis/src/interfaces/IStrategyCommon.sol";
import {INonfungiblePositionManager} from "../../CL/periphery/interfaces/INonfungiblePositionManager.sol";
import {IMinimalVoter} from "./IMinimalVoter.sol";

/**
 * @title Shadow Strategy Interface
 * @author Arca
 * @notice Interface for Shadow-specific strategy functionality
 */
interface IShadowStrategy is IStrategyCommon {
    // Shadow-specific events
    event PositionMinted(uint256 indexed tokenId, int24 tickLower, int24 tickUpper, uint128 liquidity);
    event PositionBurned(uint256 indexed tokenId);

    // Shadow-specific getters
    function getPosition() external view returns (uint256 tokenId, int24 tickLower, int24 tickUpper);
    function getNonfungiblePositionManager() external view returns (INonfungiblePositionManager);
    function getVoter() external view returns (IMinimalVoter);
    
    // Shadow-specific rebalance - clean interface without unused parameters
    function rebalance(
        int32 tickLower,
        int32 tickUpper,
        int32 desiredTick,
        int32 slippageTick,
        uint256 amountX,
        uint256 amountY
    ) external;
}
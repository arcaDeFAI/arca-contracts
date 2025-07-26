// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {ILBPair} from "joe-v2/interfaces/ILBPair.sol";
import {IStrategyCommon} from "./IStrategyCommon.sol";

/**
 * @title Metropolis Strategy Interface
 * @author Arca
 * @notice Interface for Metropolis-specific strategy functionality
 */
interface IMetropolisStrategy is IStrategyCommon {
    // Metropolis-specific errors
    error Strategy__InvalidRange();
    error Strategy__ActiveIdSlippage();
    error Strategy__RangeAlreadySet();
    error Strategy__RangeTooWide();
    error Strategy__InvalidLength();

    // Metropolis-specific events
    event RangeSet(int32 low, int32 upper);

    // Metropolis-specific getters
    function getPair() external pure returns (ILBPair);
    function getRange() external view returns (int32 low, int32 upper);
    function getMaxRange() external view returns (uint256);

    // Metropolis-specific rebalance
    function rebalance(
        int32 newLower,
        int32 newUpper,
        int32 desiredActiveId,
        int32 slippageActiveId,
        uint256 amountX,
        uint256 amountY,
        bytes calldata distributions
    ) external;
}
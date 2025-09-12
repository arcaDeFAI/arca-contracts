// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {ILBPair} from "@arca/joe-v2/interfaces/ILBPair.sol";
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
    event RangeSet(uint24 low, uint24 upper);

    // SANITY CHECK EVENTS FOR REBALANCE OPERATION
    event RebalanceStart(
        uint24 newLower,
        uint24 newUpper,
        uint24 desiredActiveId,
        uint24 slippageActiveId,
        uint256 amountX,
        uint256 amountY
    );

    event RebalanceWithdrawAndApplyFee(
        uint256 queuedShares,
        uint256 queuedAmountX,
        uint256 queuedAmountY
    );

    event RebalanceReadyToDepositToLB(
        uint24 lower,
        uint24 upper,
        uint256 amountX,
        uint256 amountY
    );

    // Metropolis-specific getters
    function getPair() external pure returns (ILBPair);
    function getRange() external view returns (uint24 low, uint24 upper);
    function getMaxRange() external view returns (uint256);

    // Metropolis-specific rebalance
    function rebalance(
        uint24 newLower,
        uint24 newUpper,
        uint24 desiredActiveId,
        uint24 slippageActiveId,
        uint256 amountX,
        uint256 amountY,
        bytes calldata distributions
    ) external;
}

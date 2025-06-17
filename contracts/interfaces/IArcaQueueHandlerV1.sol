// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IDepositWithdrawCompatible} from "./IDepositWithdrawCompatible.sol";
import {TokenValidator} from "../TokenTypes.sol";

interface IArcaQueueHandlerV1 {
    function depositQueueStart() external view returns (uint256);
    function enqueueDepositRequest(
        IDepositWithdrawCompatible.DepositRequest memory depositRequest
    ) external;
    function enqueueWithdrawRequest(
        IDepositWithdrawCompatible.WithdrawRequest memory withdrawRequest
    ) external;
    function getDepositQueueLength() external view returns (uint256);
    function getDepositQueueTrailingSlice()
        external
        returns (IDepositWithdrawCompatible.DepositRequest[] memory);
    function getPendingDepositsCount() external view returns (uint256);
    function getPendingWithdrawsCount() external view returns (uint256);
    function getQueuedToken(
        TokenValidator.Type tokenType
    ) external view returns (uint256);
    function getWithdrawQueueLength() external view returns (uint256);
    function getWithdrawQueueTrailingSlice()
        external
        returns (IDepositWithdrawCompatible.WithdrawRequest[] memory);
    function reduceQueuedToken(
        uint256 amount,
        TokenValidator.Type tokenType
    ) external;
    function withdrawQueueStart() external view returns (uint256);
}

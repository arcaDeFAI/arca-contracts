// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { TokenValidator } from "../TokenTypes.sol";
import { IArcaQueueHandlerV1 } from "../interfaces/IArcaQueueHandlerV1.sol";
import { IDepositWithdrawCompatible } from "../interfaces/IDepositWithdrawCompatible.sol";

contract ArcaQueueHandlerV1 is Ownable, IDepositWithdrawCompatible, TokenValidator, IArcaQueueHandlerV1 {
    // Queue management
    DepositRequest[] private depositQueue;
    WithdrawRequest[] private withdrawQueue;
    uint256 public depositQueueStart;
    uint256 public withdrawQueueStart;
    
    // Track tokens waiting in queues
    uint256[TOKEN_COUNT] private _queuedTokens;

    function getQueuedToken(TokenValidator.Type tokenType) public view validToken(tokenType) returns(uint256) {
        return _queuedTokens[uint256(tokenType)];
    }

    // Events
    event DepositQueued(address indexed user, uint256 amount, uint256 tokenType);
    event WithdrawQueued(address indexed user, uint256 sharesX, uint256 sharesY);

    constructor() Ownable(msg.sender) {
        depositQueueStart = 0;
        withdrawQueueStart = 0;
    }

    function reduceQueuedToken(uint256 amount, TokenValidator.Type tokenType) external onlyOwner validToken(tokenType) {
        require(getQueuedToken(tokenType) >= amount, "Not enough tokens in queue");
        _queuedTokens[uint256(tokenType)] -= amount;
    }

    function getDepositQueueTrailingSlice() external onlyOwner returns(DepositRequest[] memory){
        uint256 length = depositQueue.length;
        require(depositQueueStart <= length, "DepositQueue start out of bounds");
        uint256 sliceLength = length - depositQueueStart;
        DepositRequest[] memory slicedDepositQueue = new DepositRequest[](sliceLength);

        for (uint256 i = 0; i < sliceLength; i++) {
            slicedDepositQueue[i] = depositQueue[i + depositQueueStart];
        }

        // Clear processed deposits
        depositQueueStart += sliceLength;

        return slicedDepositQueue;
    }

    function getWithdrawQueueTrailingSlice() external onlyOwner returns(WithdrawRequest[] memory){
        uint256 length = withdrawQueue.length;
        require(withdrawQueueStart <= length, "Withdraw queue start out of bounds");
        uint256 sliceLength = length - withdrawQueueStart;
        WithdrawRequest[] memory slicedWithdrawQueue = new WithdrawRequest[](sliceLength);

        for (uint256 i = 0; i < sliceLength; i++) {
            slicedWithdrawQueue[i] = withdrawQueue[i + withdrawQueueStart];
        }

        // Clear processed withdrawals
        withdrawQueueStart += sliceLength;

        return slicedWithdrawQueue;
    }

    function enqueueDepositRequest(DepositRequest memory depositRequest) 
        external onlyOwner validToken(depositRequest.tokenType) {

        // Add to deposit queue with net amount
        depositQueue.push(depositRequest);

        // Track queued tokens
        _queuedTokens[uint256(depositRequest.tokenType)] += depositRequest.amount;

        emit DepositQueued(msg.sender, depositRequest.amount, uint256(depositRequest.tokenType));
    }

    function enqueueWithdrawRequest(WithdrawRequest memory withdrawRequest) external onlyOwner {
        // Add to withdraw queue
        withdrawQueue.push(withdrawRequest);
        emit WithdrawQueued(msg.sender,
                            withdrawRequest.shares[uint256(TokenValidator.Type.TokenX)],
                            withdrawRequest.shares[uint256(TokenValidator.Type.TokenY)]);
    }

    // View functions for queue management
    function getDepositQueueLength() external view returns (uint256) {
        return depositQueue.length;
    }

    function getWithdrawQueueLength() external view returns (uint256) {
        return withdrawQueue.length;
    }

    function getPendingDepositsCount() external view returns (uint256) {
        return depositQueue.length - depositQueueStart;
    }

    function getPendingWithdrawsCount() external view returns (uint256) {
        return withdrawQueue.length - withdrawQueueStart;
    }
}
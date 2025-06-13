// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

// This interface is just so to share some struct definitions between contracts
interface IDepositWithdrawCompatible {
    // Structs for queue management
    struct DepositRequest {
        address user;
        uint256 amount;
        bool isTokenX; // true for tokenX, false for tokenY
        uint256 timestamp;
    }
    
    struct WithdrawRequest {
        address user;
        uint256 sharesX;
        uint256 sharesY;
        uint256 timestamp;
    }
}

contract arcaQueueHandlerV1 is Ownable, IDepositWithdrawCompatible {
    // Queue management
    DepositRequest[] private depositQueue;
    WithdrawRequest[] private withdrawQueue;
    uint256 public depositQueueStart;
    uint256 public withdrawQueueStart;
    
    // Track tokens waiting in queues
    uint256 public queuedTokenX;
    uint256 public queuedTokenY;

    // Events
    event DepositQueued(address indexed user, uint256 amount, bool isTokenX);
    event WithdrawQueued(address indexed user, uint256 sharesX, uint256 sharesY);

    constructor() Ownable(msg.sender) {
        depositQueueStart = 0;
        withdrawQueueStart = 0;
    }

    function reduceQueuedToken(uint256 amount, bool isTokenX) external onlyOwner {
        if (isTokenX) {
            require(queuedTokenX >= amount, "Cannot remove more tokens than queued");
            queuedTokenX -= amount;
        } else {
            require(queuedTokenY >= amount, "Cannot remove more tokens than queued");
            queuedTokenY -= amount;
        }
    }

    function getDepositQueueTrailingSlice() external onlyOwner returns(DepositRequest[] memory){
        uint length = depositQueue.length;
        require(depositQueueStart <= length, "Deposit queue start out of bounds");
        uint sliceLength = length - depositQueueStart;
        DepositRequest[] memory slicedDepositQueue = new DepositRequest[](sliceLength);

        for (uint i = 0; i < sliceLength; i++) {
            slicedDepositQueue[i] = depositQueue[i + depositQueueStart];
        }

        // Clear processed deposits
        depositQueueStart += sliceLength;

        return slicedDepositQueue;
    }

    function getWithdrawQueueTrailingSlice() external onlyOwner returns(WithdrawRequest[] memory){
        uint length = withdrawQueue.length;
        require(withdrawQueueStart <= length, "Withdraw queue start out of bounds");
        uint sliceLength = length - withdrawQueueStart;
        WithdrawRequest[] memory slicedWithdrawQueue = new WithdrawRequest[](sliceLength);

        for (uint i = 0; i < sliceLength; i++) {
            slicedWithdrawQueue[i] = withdrawQueue[i + withdrawQueueStart];
        }

        // Clear processed withdrawals
        withdrawQueueStart += sliceLength;

        return slicedWithdrawQueue;
    }

    function enqueueDepositRequest(DepositRequest memory depositRequest) external onlyOwner {
        // Add to deposit queue with net amount
        depositQueue.push(depositRequest);
        
        // Track queued tokens
        if (depositRequest.isTokenX) {
            queuedTokenX += depositRequest.amount;
        } else {
            queuedTokenY += depositRequest.amount;
        }

        emit DepositQueued(msg.sender, depositRequest.amount, depositRequest.isTokenX);
    }

    function enqueueWithdrawRequest(WithdrawRequest memory withdrawRequest) external onlyOwner {
        // Add to withdraw queue
        withdrawQueue.push(withdrawRequest);
        emit WithdrawQueued(msg.sender, withdrawRequest.sharesX, withdrawRequest.sharesY);
    }

    // View functions for queue management
    /**
     * @dev Get deposit queue length
     */
    function getDepositQueueLength() external view returns (uint256) {
        return depositQueue.length;
    }

    /**
     * @dev Get withdraw queue length
     */
    function getWithdrawQueueLength() external view returns (uint256) {
        return withdrawQueue.length;
    }

    /**
     * @dev Get pending deposits count
     */
    function getPendingDepositsCount() external view returns (uint256) {
        return depositQueue.length - depositQueueStart;
    }

    /**
     * @dev Get pending withdrawals count
     */
    function getPendingWithdrawsCount() external view returns (uint256) {
        return withdrawQueue.length - withdrawQueueStart;
    }
}
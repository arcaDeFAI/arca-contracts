// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

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
    DepositRequest[] public depositQueue;
    WithdrawRequest[] public withdrawQueue;
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

    /**
     * @dev Internal function to process withdraw queue
     * Calculates each user's share of withdrawn tokens and processes their withdrawal
     */
    function processWithdrawQueue(uint256 totalXRemoved, uint256 totalYRemoved) private onlyOwner returns (uint256 processed) {
        uint256 queueLength = withdrawQueue.length;
        
        for (uint256 i = withdrawQueueStart; i < queueLength; i++) {
            WithdrawRequest memory request = withdrawQueue[i];
            
            // Calculate user's share of withdrawn tokens
            uint256 userAmountX = 0;
            uint256 userAmountY = 0;
            
            if (request.sharesX > 0 && totalSharesX > 0) {
                // Share of removed liquidity
                userAmountX = (totalXRemoved * request.sharesX) / totalSharesX;
                uint256 existingX = balanceX();
                if (existingX > 0) {
                    userAmountX += (existingX * request.sharesX) / totalSharesX;
                }
            }
            
            if (request.sharesY > 0 && totalSharesY > 0) {
                // Share of removed liquidity
                userAmountY = (totalYRemoved * request.sharesY) / totalSharesY;
                uint256 existingY = balanceY();
                if (existingY > 0) {
                    userAmountY += (existingY * request.sharesY) / totalSharesY;
                }
            }
            
            // Calculate withdraw fee on total withdrawal amount
            uint256 totalWithdrawAmount = userAmountX + userAmountY;
            uint256 withdrawFee = (totalWithdrawAmount * feeManager.getWithdrawFee()) / feeManager.BASIS_POINTS();
            
            // Apply fee proportionally to both tokens
            if (withdrawFee > 0 && totalWithdrawAmount > 0) {
                uint256 feeX = (userAmountX * withdrawFee) / totalWithdrawAmount;
                uint256 feeY = (userAmountY * withdrawFee) / totalWithdrawAmount;
                
                userAmountX -= feeX;
                userAmountY -= feeY;
                
                // Send fees to fee recipient
                if (feeX > 0) {
                    IERC20(vaultConfig.tokenX).safeTransfer(feeManager.getFeeRecipient(), feeX);
                }
                if (feeY > 0) {
                    IERC20(vaultConfig.tokenY).safeTransfer(feeManager.getFeeRecipient(), feeY);
                }
                
                emit FeeCollected(feeManager.getFeeRecipient(), withdrawFee, "withdraw");
            }
            
            // Burn user's shares
            sharesX[request.user] -= request.sharesX;
            sharesY[request.user] -= request.sharesY;
            totalSharesX -= request.sharesX;
            totalSharesY -= request.sharesY;
            
            // Transfer tokens to user
            if (userAmountX > 0) {
                IERC20(vaultConfig.tokenX).safeTransfer(request.user, userAmountX);
            }
            if (userAmountY > 0) {
                IERC20(vaultConfig.tokenY).safeTransfer(request.user, userAmountY);
            }
            
            emit WithdrawProcessed(request.user, userAmountX, userAmountY);
            processed++;
        }
        
        // Clear processed withdrawals
        if (processed > 0) {
            withdrawQueueStart = queueLength;
        }
        
        return processed;
    }

    // TODO RAPH: I want to move the processDepositQueue and processWithdraw thing to the queueHandler
    // For this to be possible, I will need to pass a lot of arguments, modifying arrays "in place" (by reference)
    // https://ethereum.stackexchange.com/questions/98855/modify-in-place-an-array-received-as-function-argument
    // I should possibly use a struct for the input to group everything together

    /**
     * @dev Internal function to process deposit queue
     * Mints shares based on current token balances after withdrawals are processed and rewards compounded
     */
    function processDepositQueue() private onlyOwner returns (uint256 processed) {
        uint256 queueLength = depositQueue.length;
            
        for (uint256 i = depositQueueStart; i < queueLength; i++) {
            DepositRequest memory request = depositQueue[i];
            
            uint256 newShares = 0;
            
            if (request.isTokenX) {
                // Calculate sharesX to mint (benefits from compounded rewards increasing balance)
                if (totalSharesX == 0) {
                    newShares = request.amount;
                } else {
                    uint256 currentBalanceX = balanceX();
                    if (currentBalanceX > 0) {
                        newShares = (request.amount * totalSharesX) / currentBalanceX;
                    } else {
                        newShares = request.amount; // Fallback if no balance
                    }
                }
                
                // Update user shares and totals AFTER calculation
                sharesX[request.user] += newShares;
                totalSharesX += newShares;
                
                // Remove from queued tokens (this adds to available balance for next person)
                queuedTokenX -= request.amount;
                
            } else {
                // Calculate sharesY to mint (benefits from compounded rewards increasing balance)
                if (totalSharesY == 0) {
                    newShares = request.amount;
                } else {
                    uint256 currentBalanceY = balanceY();
                    if (currentBalanceY > 0) {
                        newShares = (request.amount * totalSharesY) / currentBalanceY;
                    } else {
                        newShares = request.amount; // Fallback if no balance
                    }
                }
                
                // Update user shares and totals AFTER calculation
                sharesY[request.user] += newShares;
                totalSharesY += newShares;
                
                // Remove from queued tokens (this adds to available balance for next person)
                queuedTokenY -= request.amount;
            }
            
            emit SharesMinted(request.user, request.isTokenX ? newShares : 0, request.isTokenX ? 0 : newShares);
            processed++;
        }
        
        // Clear processed deposits
        if (processed > 0) {
            depositQueueStart = queueLength;
        }
        
        return processed;
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {TokenValidator} from "../TokenTypes.sol";
import {IArcaQueueHandlerV1} from "../interfaces/IArcaQueueHandlerV1.sol";
import {
    IDepositWithdrawCompatible
} from "../interfaces/IDepositWithdrawCompatible.sol";

contract ArcaQueueHandlerV1 is
    Initializable,
    OwnableUpgradeable,
    IDepositWithdrawCompatible,
    TokenValidator,
    IArcaQueueHandlerV1
{
    // Queue management
    DepositRequest[] private depositQueue;
    WithdrawRequest[] private withdrawQueue;
    uint256 public depositQueueStart;
    uint256 public withdrawQueueStart;

    // Track tokens waiting in queues
    uint256[TOKEN_COUNT] private _queuedTokens;

    function getQueuedToken(
        TokenValidator.Type tokenType
    ) public view validToken(tokenType) returns (uint256) {
        return _queuedTokens[uint256(tokenType)];
    }

    // Events
    event DepositQueued(
        address indexed user,
        uint256 amount,
        uint256 tokenType
    );
    event WithdrawQueued(
        address indexed user,
        uint256 sharesX,
        uint256 sharesY
    );

    /**
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the queue handler
     */
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        depositQueueStart = 0;
        withdrawQueueStart = 0;
    }

    function reduceQueuedToken(
        uint256 amount,
        TokenValidator.Type tokenType
    ) external onlyOwner validToken(tokenType) {
        require(
            getQueuedToken(tokenType) >= amount,
            "Not enough tokens in queue"
        );
        _queuedTokens[uint256(tokenType)] -= amount;
    }

    function _buildPendingDepositSlice()
        private
        view
        returns (DepositRequest[] memory)
    {
        uint256 length = depositQueue.length;
        require(
            depositQueueStart <= length,
            "DepositQueue start out of bounds"
        );
        uint256 sliceLength = length - depositQueueStart;
        DepositRequest[] memory slicedDepositQueue = new DepositRequest[](
            sliceLength
        );

        for (uint256 i = 0; i < sliceLength; i++) {
            slicedDepositQueue[i] = depositQueue[i + depositQueueStart];
        }

        return slicedDepositQueue;
    }

    function getPendingDepositRequests()
        external
        view
        onlyOwner
        returns (DepositRequest[] memory)
    {
        return _buildPendingDepositSlice();
    }

    function getDepositQueueTrailingSlice()
        external
        onlyOwner
        returns (DepositRequest[] memory)
    {
        DepositRequest[] memory slicedDepositQueue = _buildPendingDepositSlice();
        
        // Clear processed deposits
        depositQueueStart += slicedDepositQueue.length;

        return slicedDepositQueue;
    }

    function _buildPendingWithdrawSlice()
        private
        view
        returns (WithdrawRequest[] memory)
    {
        uint256 length = withdrawQueue.length;
        require(
            withdrawQueueStart <= length,
            "Withdraw queue start out of bounds"
        );
        uint256 sliceLength = length - withdrawQueueStart;
        WithdrawRequest[] memory slicedWithdrawQueue = new WithdrawRequest[](
            sliceLength
        );

        for (uint256 i = 0; i < sliceLength; i++) {
            slicedWithdrawQueue[i] = withdrawQueue[i + withdrawQueueStart];
        }

        return slicedWithdrawQueue;
    }

    function getPendingWithdrawRequests()
        external
        view
        onlyOwner
        returns (WithdrawRequest[] memory)
    {
        return _buildPendingWithdrawSlice();
    }

    function getWithdrawQueueTrailingSlice()
        external
        onlyOwner
        returns (WithdrawRequest[] memory)
    {
        WithdrawRequest[] memory slicedWithdrawQueue = _buildPendingWithdrawSlice();
        
        // Clear processed withdrawals
        withdrawQueueStart += slicedWithdrawQueue.length;

        return slicedWithdrawQueue;
    }

    function enqueueDepositRequest(
        DepositRequest memory depositRequest
    ) external onlyOwner validToken(depositRequest.tokenType) {
        // Add to deposit queue with net amount
        depositQueue.push(depositRequest);

        // Track queued tokens
        _queuedTokens[uint256(depositRequest.tokenType)] += depositRequest
            .amount;

        emit DepositQueued(
            depositRequest.user,
            depositRequest.amount,
            uint256(depositRequest.tokenType)
        );
    }

    function enqueueWithdrawRequest(
        WithdrawRequest memory withdrawRequest
    ) external onlyOwner {
        // Add to withdraw queue
        withdrawQueue.push(withdrawRequest);
        emit WithdrawQueued(
            withdrawRequest.user,
            withdrawRequest.shares[uint256(TokenValidator.Type.TokenX)],
            withdrawRequest.shares[uint256(TokenValidator.Type.TokenY)]
        );
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

    /**
     * @dev Storage gap for future upgrades
     * This gap allows us to add new storage variables in future versions
     * Current storage slots used: ~10 (estimated)
     * Gap size: 50 - 10 = 40 slots reserved
     */
    uint256[40] private __gap;
}

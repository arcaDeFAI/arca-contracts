// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IFeeRecipient {
    error STF();
    error NOT_AUTHORIZED();
    
    function initialize(address _feeDistributor) external;
    function notifyFees() external;
}

// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.28;

import { TokenValidator } from "../TokenTypes.sol";

// This interface is just so to share some struct definitions between contracts
interface IDepositWithdrawCompatible {
    // Structs for queue management
    struct DepositRequest {
        address user;
        uint256 amount;
        TokenValidator.Type tokenType;
        uint256 timestamp;
    }
    
    struct WithdrawRequest {
        address user;
        uint256[2] shares; 
        uint256 timestamp;
    }
}
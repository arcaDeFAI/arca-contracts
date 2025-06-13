// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.28;

contract TokenValidator {
    enum Type {
        TokenX, // Token at index 0
        TokenY  // Token at index 1
    } // Total count of 2 tokens

    uint256 constant public COUNT = 2;

    error InvalidTokenType();

    modifier validToken(Type tokenType) {
        if (uint256(tokenType) >= COUNT) revert InvalidTokenType();
        _;
    }
}
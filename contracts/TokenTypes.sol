// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Define a small contract for token definitions,
// so that other contracts can inherit the "validToken" modifier
contract TokenValidator {
    enum Type {
        TokenX, // Token at index 0
        TokenY // Token at index 1
    } // Total count of 2 tokens

    uint256 public constant TOKEN_COUNT = 2;

    error InvalidTokenType();

    modifier validToken(Type tokenType) {
        if (uint256(tokenType) >= TOKEN_COUNT) revert InvalidTokenType();
        _;
    }
}

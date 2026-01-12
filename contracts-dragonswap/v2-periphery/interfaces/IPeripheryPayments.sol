// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.5;

/// @title Periphery Payments
/// @notice Functions to ease deposits and withdrawals of SEI
interface IPeripheryPayments {
    /// @notice Unwraps the contract's WSEI balance and sends it to recipient as SEI.
    /// @dev The amountMinimum parameter prevents malicious contracts from stealing WSEI from users.
    /// @param amountMinimum The minimum amount of WSEI to unwrap
    /// @param recipient The address receiving SEI
    function unwrapWSEI(uint256 amountMinimum, address recipient) external payable;

    /// @notice Refunds any SEI balance held by this contract to the `msg.sender`
    /// @dev Useful for bundling with mint or increase liquidity that uses sei, or exact output swaps
    /// that use sei for the input amount
    function refundSEI() external payable;

    /// @notice Transfers the full amount of a token held by this contract to recipient
    /// @dev The amountMinimum parameter prevents malicious contracts from stealing the token from users
    /// @param token The contract address of the token which will be transferred to `recipient`
    /// @param amountMinimum The minimum amount of token required for a transfer
    /// @param recipient The destination address of the token
    function sweepToken(
        address token,
        uint256 amountMinimum,
        address recipient
    ) external payable;
}

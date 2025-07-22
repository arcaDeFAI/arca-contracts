// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.26;

interface IFeeRecipientFactory {
    error INVALID_TREASURY_FEE();
    error NOT_AUTHORIZED();

    /// @notice the pair fees for a specific pair
    /// @param pair the pair to check
    /// @return feeRecipient the feeRecipient contract address for the pair
    function feeRecipientForPair(
        address pair
    ) external view returns (address feeRecipient);

    /// @notice the last feeRecipient address created
    /// @return _feeRecipient the address of the last pair fees contract
    function lastFeeRecipient() external view returns (address _feeRecipient);
    /// @notice create the pair fees for a pair
    /// @param pair the address of the pair
    /// @return _feeRecipient the address of the newly created feeRecipient
    function createFeeRecipient(
        address pair
    ) external returns (address _feeRecipient);

    /// @notice the fee % going to the treasury
    /// @return _feeToTreasury the fee %
    function feeToTreasury() external view returns (uint256 _feeToTreasury);

    /// @notice get the treasury address
    /// @return _treasury address of the treasury
    function treasury() external view returns (address _treasury);

    /// @notice set the fee % to be sent to the treasury
    /// @param _feeToTreasury the fee % to be sent to the treasury
    function setFeeToTreasury(uint256 _feeToTreasury) external;

    /// @notice set a new treasury address
    /// @param _treasury the new address
    function setTreasury(address _treasury) external;
}

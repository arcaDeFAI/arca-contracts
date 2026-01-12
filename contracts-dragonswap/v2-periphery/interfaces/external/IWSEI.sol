// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @title Interface for WSEI
interface IWSEI is IERC20 {
    /// @notice Deposit sei to get wrapped sei
    function deposit() external payable;

    /// @notice Withdraw wrapped sei to get sei
    function withdraw(uint256) external;
}

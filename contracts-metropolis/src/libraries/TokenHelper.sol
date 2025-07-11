// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {SafeERC20, IERC20} from "openzeppelin/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Token Helper
 * @dev Helper library to handle ERC20 and native tokens
 */
library TokenHelper {
    using SafeERC20 for IERC20;

    error TokenHelper__NativeTransferFailed();

    /**
     * @dev Helper function to return the balance of an account for the given token
     * address(0) is used for native tokens
     * @param token The address of the token
     * @param account The address of the account
     * @return The balance of this contract for the given token
     */
    function safeBalanceOf(IERC20 token, address account) internal view returns (uint256) {
        return address(token) == address(0) ? address(account).balance : token.balanceOf(account);
    }

    /**
     * @dev Helper function to transfer the given amount of tokens to the given address
     * address(0) is used for native tokens
     * @param token The address of the token
     * @param to The address of the recipient
     * @param amount The amount of tokens
     */
    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        if (amount > 0) {
            if (address(token) == address(0)) {
                (bool s,) = to.call{value: amount}("");
                if (!s) revert TokenHelper__NativeTransferFailed();
            } else {
                token.safeTransfer(to, amount);
            }
        }
    }
}

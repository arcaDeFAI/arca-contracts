// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title MockVaultFactory
 * @dev Minimal mock implementation of VaultFactory for testing
 */
contract MockVaultFactory {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    // Basic functions that vaults might call
    function getWNative() external pure returns (address) {
        return 0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38; // Mock wS address
    }

    function getDefaultOperator() external view returns (address) {
        return owner;
    }

    function getFeeRecipient() external view returns (address) {
        return owner;
    }

    function getFeeRecipientByVault(address) external view returns (address) {
        return owner;
    }

    function getDepositToWithdrawCooldown() external pure returns (uint256) {
        return 0;
    }

    function isTransferIgnored(address) external pure returns (bool) {
        return false;
    }
}

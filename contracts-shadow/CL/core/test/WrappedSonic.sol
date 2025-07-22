// SPDX-License-Identifier: MIT
// SonicLabs Core Contracts (last updated v1.0.0)
pragma solidity ^0.8.26;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/// WrappedSonic represents an official ERC20 implementation
/// of the native Sonic main-net currency.
contract WrappedSonic is ERC20 {
    /// @dev Indicates a failure with the native token amount.
    error ERC20InvalidZeroDeposit();

    /// @dev Indicates a failure with the native token transfer on withdraw.
    /// @param recipient Address to receive the native transfer.
    /// @param value The amount of native tokens to be sent.
    error ERC20WithdrawFailed(address recipient, uint256 value);

    /// @dev Indicates a successful deposit for the given owner and amount.
    /// @param account Account address which receive the minted ERC20 token.
    /// @param value The amount of ERC20 tokens deposited.
    event Deposit(address indexed account, uint value);

    /// @dev Indicates a successful withdrawal for the given owner and amount.
    /// @param account Account address which receive the withdrawn native token.
    /// @param value The amount of native tokens withdrawn.
    event Withdrawal(address indexed account, uint value);

    /// @dev Create a new instance of the contract
    constructor() ERC20('Wrapped Sonic', 'wS') {}

    fallback() external payable {
        deposit();
    }

    /// @dev Allow a user to deposit native tokens and mint the corresponding number of wrapped tokens.
    /// @param account The address to receive the minted wrapped tokens.
    function depositFor(address account) public payable returns (bool) {
        address sender = _msgSender();

        if (sender == address(this)) {
            revert ERC20InvalidSender(address(this));
        }
        if (account == address(this)) {
            revert ERC20InvalidReceiver(account);
        }
        if (msg.value == 0) {
            revert ERC20InvalidZeroDeposit();
        }

        _mint(account, msg.value);

        emit Deposit(account, msg.value);
        return true;
    }

    /// @dev Allow a user to burn a number of wrapped tokens and withdraw the corresponding number of native tokens.
    /// @param account The recipient of the native tokens.
    /// @param value The amount of wrapped tokens to be burned.
    function withdrawTo(address account, uint256 value) public returns (bool) {
        if (account == address(this)) {
            revert ERC20InvalidReceiver(account);
        }

        _burn(_msgSender(), value);

        (bool _success, ) = payable(account).call{value: value}('');
        if (!_success) {
            revert ERC20WithdrawFailed(account, value);
        }

        emit Withdrawal(account, value);
        return true;
    }

    /// @dev Allow to deposit native tokens and mint the corresponding number of wrapped tokens to self account.
    function deposit() public payable {
        depositFor(_msgSender());
    }

    /// @dev Allow withdraw by burning own wrapped tokens, the corresponding amount of native tokens are released.
    /// @param value Amount to be withdrawn.
    function withdraw(uint value) public {
        withdrawTo(_msgSender(), value);
    }
}

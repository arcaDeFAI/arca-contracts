// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        address initialHolder
    ) ERC20(name, symbol) {
        _decimals = decimals_;

        // Mint 1 billion tokens to initial holder (adjusted for decimals)
        if (initialHolder != address(0)) {
            _mint(initialHolder, 1_000_000_000 * (10 ** uint256(decimals_)));
        }
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

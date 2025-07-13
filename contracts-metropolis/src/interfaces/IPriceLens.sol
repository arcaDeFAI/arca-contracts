// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

interface IPriceLens {
    /// @notice Returns the price of token in Native, scaled with `DECIMALS` decimals
    /// @param _token The address of the token
    /// @return price The price of the token in Native, with `DECIMALS` decimals
    function getTokenPriceNative(address _token) external view returns (uint256 price);
}

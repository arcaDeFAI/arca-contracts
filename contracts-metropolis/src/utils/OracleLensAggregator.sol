// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {IAggregatorV3} from "../../src/interfaces/IAggregatorV3.sol";
import {Ownable} from "openzeppelin/access/Ownable.sol";
import "../interfaces/IPriceLens.sol";

contract OracleLensAggregator is Ownable, IAggregatorV3 {
    IPriceLens public immutable lens;
    address public immutable token;

    constructor(address _priceLens, address _token) {
        lens = IPriceLens(_priceLens);
        token = _token;
    }

    /// @dev returns price in WNATIVE
    function _getPriceNativeFromLens() internal view returns (int256) {
        uint256 price = lens.getTokenPriceNative(token); // WNATIVE is 18 decimals

        int256 scaledPrice = int256(price); // int256(price) / (10**(18 - 8)); // scale it

        return scaledPrice;
    }

    function decimals() external pure override returns (uint8) {
        return 18; // WNATIVE is 18 decimals
    }

    function description() external pure override returns (string memory) {
        return "OracleLensAggregator";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80)
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (0, _getPriceNativeFromLens(), 0, block.timestamp, 0);
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (0, _getPriceNativeFromLens(), 0, block.timestamp, 0);
    }

    function setPrice(int256 _price) external onlyOwner {
        // nothing
    }
}

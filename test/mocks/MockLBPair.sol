// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockLBPair
 * @dev Mock LB pair for testing MetropolisPriceHelper.
 * Implements only the methods needed by the price helper.
 */
contract MockLBPair {
    uint24 private _activeId;
    mapping(uint24 => uint256) private _prices;

    // Oracle data: timestamp => cumulative values
    mapping(uint40 => uint64) private _oracleCumulativeId;

    // Oracle parameters
    uint16 private _oracleSize;

    IERC20 private _tokenX;
    IERC20 private _tokenY;

    constructor(
        address tokenX,
        address tokenY,
        uint24 activeId,
        uint256 spotPrice
    ) {
        _tokenX = IERC20(tokenX);
        _tokenY = IERC20(tokenY);
        _activeId = activeId;
        _prices[activeId] = spotPrice;
        _oracleSize = 1; // non-zero = oracle enabled
    }

    function getActiveId() external view returns (uint24) {
        return _activeId;
    }

    function getPriceFromId(uint24 id) external view returns (uint256) {
        return _prices[id];
    }

    function getOracleSampleAt(
        uint40 lookupTimestamp
    )
        external
        view
        returns (
            uint64 cumulativeId,
            uint64 cumulativeVolatility,
            uint64 cumulativeBinCrossed
        )
    {
        return (_oracleCumulativeId[lookupTimestamp], 0, 0);
    }

    function getOracleParameters()
        external
        view
        returns (
            uint8 sampleLifetime,
            uint16 size,
            uint16 activeSize,
            uint40 lastUpdated,
            uint40 firstTimestamp
        )
    {
        return (0, _oracleSize, _oracleSize, 0, 0);
    }

    function getTokenX() external view returns (IERC20) {
        return _tokenX;
    }

    function getTokenY() external view returns (IERC20) {
        return _tokenY;
    }

    // ============ Test Helper Functions ============

    function setActiveId(uint24 activeId) external {
        _activeId = activeId;
    }

    function setPriceForId(uint24 id, uint256 price) external {
        _prices[id] = price;
    }

    function setOracleSample(uint40 timestamp, uint64 cumulativeId) external {
        _oracleCumulativeId[timestamp] = cumulativeId;
    }

    function setOracleSize(uint16 size) external {
        _oracleSize = size;
    }
}

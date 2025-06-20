// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockLBPair {
    uint24 private activeId = 8388608; // Mock active ID (2^23)

    function getActiveId() external view returns (uint24) {
        return activeId;
    }

    function setActiveId(uint24 _activeId) external {
        activeId = _activeId;
    }

    function getPriceFromId(uint24 id) external pure returns (uint256) {
        // Mock price calculation - return a fixed price for testing
        // In real LB pairs, this would be (1 + binStep/10000)^(id - 2^23)
        return 2 ** 128; // 1.0 in 128.128 fixed point
    }

    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)
    {
        // Mock reserves for AMM V2 style interface
        reserve0 = 1000000;
        reserve1 = 1000000;
        blockTimestampLast = uint32(block.timestamp);
    }
}

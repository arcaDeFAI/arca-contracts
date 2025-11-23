// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.26;

/**
 * @title SimpleMockPool
 * @dev Minimal mock pool for Shadow vault testing
 */
contract SimpleMockPool {
    struct Slot0 {
        uint160 sqrtPriceX96;
        int24 tick;
        uint16 observationIndex;
        uint16 observationCardinality;
        uint16 observationCardinalityNext;
        uint8 feeProtocol;
        bool unlocked;
    }

    Slot0 private _slot0;
    address private _token0;
    address private _token1;

    constructor(
        address tokenA,
        address tokenB,
        uint160 sqrtPriceX96,
        int24 tick
    ) {
        _token0 = tokenA;
        _token1 = tokenB;
        _slot0 = Slot0({
            sqrtPriceX96: sqrtPriceX96,
            tick: tick,
            observationIndex: 0,
            observationCardinality: 1,
            observationCardinalityNext: 1,
            feeProtocol: 0,
            unlocked: true
        });
    }

    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        Slot0 memory slot = _slot0;
        return (
            slot.sqrtPriceX96,
            slot.tick,
            slot.observationIndex,
            slot.observationCardinality,
            slot.observationCardinalityNext,
            slot.feeProtocol,
            slot.unlocked
        );
    }

    function observe(
        uint32[] calldata
    ) external view returns (int56[] memory tickCumulatives, uint160[] memory) {
        tickCumulatives = new int56[](1);
        tickCumulatives[0] =
            int56(_slot0.tick) * int56(uint56(block.timestamp));

        uint160[] memory liquidityCumulatives = new uint160[](1);
        liquidityCumulatives[0] = 0;

        return (tickCumulatives, liquidityCumulatives);
    }

    function token0() external view returns (address) {
        return _token0;
    }

    function token1() external view returns (address) {
        return _token1;
    }

    // Helper functions for testing
    function setSqrtPriceX96(uint160 newSqrtPriceX96) external {
        _slot0.sqrtPriceX96 = newSqrtPriceX96;
    }

    function setTick(int24 newTick) external {
        _slot0.tick = newTick;
    }
}

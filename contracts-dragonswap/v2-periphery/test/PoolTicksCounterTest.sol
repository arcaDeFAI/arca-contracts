// SPDX-License-Identifier: GPL-2.0-or-later
import '@dragonswap/v2-core/contracts/interfaces/IDragonswapV2Pool.sol';

pragma solidity >=0.6.0;

import '../libraries/PoolTicksCounter.sol';

contract PoolTicksCounterTest {
    using PoolTicksCounter for IDragonswapV2Pool;

    function countInitializedTicksCrossed(
        IDragonswapV2Pool pool,
        int24 tickBefore,
        int24 tickAfter
    ) external view returns (uint32 initializedTicksCrossed) {
        return pool.countInitializedTicksCrossed(tickBefore, tickAfter);
    }
}

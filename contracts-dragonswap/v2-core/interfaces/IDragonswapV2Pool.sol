// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import './pool/IDragonswapV2PoolImmutables.sol';
import './pool/IDragonswapV2PoolState.sol';
import './pool/IDragonswapV2PoolDerivedState.sol';
import './pool/IDragonswapV2PoolActions.sol';
import './pool/IDragonswapV2PoolOwnerActions.sol';
import './pool/IDragonswapV2PoolEvents.sol';

/// @title The interface for a Dragonswap V2 Pool
/// @notice A Dragonswap pool facilitates swapping and automated market making between any two assets that strictly conform
/// to the ERC20 specification
/// @dev The pool interface is broken up into many smaller pieces
interface IDragonswapV2Pool is
    IDragonswapV2PoolImmutables,
    IDragonswapV2PoolState,
    IDragonswapV2PoolDerivedState,
    IDragonswapV2PoolActions,
    IDragonswapV2PoolOwnerActions,
    IDragonswapV2PoolEvents
{

}

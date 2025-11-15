// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.26;

import {IRamsesV3Factory} from './interfaces/IRamsesV3Factory.sol';
import {IRamsesV3PoolDeployer} from './interfaces/IRamsesV3PoolDeployer.sol';
import {IRamsesV3Pool} from './interfaces/IRamsesV3Pool.sol';

/// @title Canonical Ramses V3 factory
/// @notice Deploys Ramses V3 pools and manages ownership and control over pool protocol fees
contract RamsesV3Factory is IRamsesV3Factory {
    address public ramsesV3PoolDeployer;
    /// @inheritdoc IRamsesV3Factory
    mapping(int24 tickSpacing => uint24 initialFee) public override tickSpacingInitialFee;
    /// @inheritdoc IRamsesV3Factory
    mapping(address tokenA => mapping(address tokenB => mapping(int24 tickSpacing => address pool)))
        public
        override getPool;
    /// @dev pool specific fee protocol if set
    mapping(address pool => uint8 feeProtocol) _poolFeeProtocol;

    /// @inheritdoc IRamsesV3Factory
    uint8 public override feeProtocol;
    /// @inheritdoc IRamsesV3Factory
    address public feeCollector;
    address public accessHub;
    address public voter;

    struct Parameters {
        address factory;
        address token0;
        address token1;
        uint24 fee;
        int24 tickSpacing;
    }
    /// @inheritdoc IRamsesV3Factory
    Parameters public parameters;

    modifier onlyGovernance() {
        require(msg.sender == accessHub, '!GOV');
        _;
    }

    /// @dev set initial tickspacings and feeSplits
    constructor(address _accessHub) {
        accessHub = _accessHub;
        /// @dev 0.01% fee, 1bps tickspacing
        tickSpacingInitialFee[1] = 100;
        emit TickSpacingEnabled(1, 100);
        /// @dev 0.025% fee, 5bps tickspacing
        tickSpacingInitialFee[5] = 250;
        emit TickSpacingEnabled(5, 250);
        /// @dev 0.05% fee, 10bps tickspacing
        tickSpacingInitialFee[10] = 500;
        emit TickSpacingEnabled(10, 500);
        /// @dev 0.30% fee, 50bps tickspacing
        tickSpacingInitialFee[50] = 3000;
        emit TickSpacingEnabled(50, 3000);
        /// @dev 1.00% fee, 100 bps tickspacing
        tickSpacingInitialFee[100] = 10000;
        emit TickSpacingEnabled(100, 10000);
        /// @dev 2.00% fee, 200 bps tickspacing
        tickSpacingInitialFee[200] = 20000;
        emit TickSpacingEnabled(200, 20000);

        /// @dev the initial feeSplit of what is sent to the FeeCollector to be distributed to voters and the treasury
        /// @dev 5% to FeeCollector
        feeProtocol = 5;

        ramsesV3PoolDeployer = msg.sender;

        emit SetFeeProtocol(0, feeProtocol);
    }

    function initialize(address _ramsesV3PoolDeployer) external {
        require(ramsesV3PoolDeployer == msg.sender);
        ramsesV3PoolDeployer = _ramsesV3PoolDeployer;
    }

    /// @inheritdoc IRamsesV3Factory
    function createPool(
        address tokenA,
        address tokenB,
        int24 tickSpacing,
        uint160 sqrtPriceX96
    ) external override returns (address pool) {
        /// @dev ensure the tokens aren't identical
        require(tokenA != tokenB, IT());
        /// @dev sort the tokens
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        /// @dev check that token0 doesn't equal the zero address
        require(token0 != address(0), A0());
        /// @dev fetch the fee from the initial tickspacing mapping
        uint24 fee = tickSpacingInitialFee[tickSpacing];
        /// @dev ensure the fee is not 0
        require(fee != 0, F0());
        /// @dev ensure the pool doesn't exist already
        require(getPool[token0][token1][tickSpacing] == address(0), PE());
        parameters = Parameters({
            factory: address(this),
            token0: token0,
            token1: token1,
            fee: fee,
            tickSpacing: tickSpacing
        });
        pool = IRamsesV3PoolDeployer(ramsesV3PoolDeployer).deploy(token0, token1, tickSpacing);
        delete parameters;

        getPool[token0][token1][tickSpacing] = pool;
        /// @dev populate mapping in the reverse direction, deliberate choice to avoid the cost of comparing addresses
        getPool[token1][token0][tickSpacing] = pool;
        emit PoolCreated(token0, token1, fee, tickSpacing, pool);

        /// @dev if there is a sqrtPrice, initialize it to the pool
        if (sqrtPriceX96 > 0) {
            IRamsesV3Pool(pool).initialize(sqrtPriceX96);
        }
    }

    /// @inheritdoc IRamsesV3Factory
    function enableTickSpacing(int24 tickSpacing, uint24 initialFee) external override onlyGovernance {
        require(initialFee < 1_000_000, FTL());
        /// @dev tick spacing is capped at 16384 to prevent the situation where tickSpacing is so large that
        /// @dev TickBitmap#nextInitializedTickWithinOneWord overflows int24 container from a valid tick
        /// @dev 16384 ticks represents a >5x price change with ticks of 1 bips
        require(tickSpacing > 0 && tickSpacing < 16384, 'TS');
        require(tickSpacingInitialFee[tickSpacing] == 0, 'TS!0');

        tickSpacingInitialFee[tickSpacing] = initialFee;
        emit TickSpacingEnabled(tickSpacing, initialFee);
    }

    /// @inheritdoc IRamsesV3Factory
    function setFeeProtocol(uint8 _feeProtocol) external override onlyGovernance {
        require(_feeProtocol <= 100, FTL());
        uint8 feeProtocolOld = feeProtocol;
        feeProtocol = _feeProtocol;
        emit SetFeeProtocol(feeProtocolOld, _feeProtocol);
    }

    /// @inheritdoc IRamsesV3Factory
    function setPoolFeeProtocol(address pool, uint8 _feeProtocol) external onlyGovernance {
        require(_feeProtocol <= 100, FTL());
        uint8 feeProtocolOld = poolFeeProtocol(pool);
        _poolFeeProtocol[pool] = _feeProtocol;
        emit SetPoolFeeProtocol(pool, feeProtocolOld, _feeProtocol);

        IRamsesV3Pool(pool).setFeeProtocol();
    }

    /// @inheritdoc IRamsesV3Factory
    function gaugeFeeSplitEnable(address pool) external{
        if (msg.sender != voter) {
            IRamsesV3Pool(pool).setFeeProtocol();
        } else {
            _poolFeeProtocol[pool] = 100;
            IRamsesV3Pool(pool).setFeeProtocol();
        }
    }

    /// @inheritdoc IRamsesV3Factory
    function poolFeeProtocol(address pool) public view override returns (uint8 __poolFeeProtocol) {
        /// @dev override to make feeProtocol 5 by default
        return (_poolFeeProtocol[pool] == 0 ? 5 : _poolFeeProtocol[pool]);
    }

    /// @inheritdoc IRamsesV3Factory
    function setFeeCollector(address _feeCollector) external override onlyGovernance {
        emit FeeCollectorChanged(feeCollector, _feeCollector);
        feeCollector = _feeCollector;
    }

    /// @inheritdoc IRamsesV3Factory
    function setVoter(address _voter) external onlyGovernance {
        voter = _voter;
    }

    /// @inheritdoc IRamsesV3Factory
    function setFee(address _pool, uint24 _fee) external override onlyGovernance {
        IRamsesV3Pool(_pool).setFee(_fee);

        emit FeeAdjustment(_pool, _fee);
    }
}

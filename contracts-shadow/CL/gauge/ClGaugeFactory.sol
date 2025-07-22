// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.26;

import {IClGaugeFactory} from "./interfaces/IClGaugeFactory.sol";
import {GaugeV3} from "./GaugeV3.sol";
/// @title Canonical CL gauge factory
/// @notice Deploys CL gauges
contract ClGaugeFactory is IClGaugeFactory {
    /// @inheritdoc IClGaugeFactory
    address public immutable override nfpManager;
    /// @inheritdoc IClGaugeFactory
    address public immutable override voter;
    /// @inheritdoc IClGaugeFactory
    address public immutable override feeCollector;

    /// @inheritdoc IClGaugeFactory
    mapping(address => address) public override getGauge;

    constructor(address _nfpManager, address _voter, address _feeCollector) {
        nfpManager = _nfpManager;
        voter = _voter;
        feeCollector = _feeCollector;

        emit OwnerChanged(address(0), msg.sender);
    }

    /// @inheritdoc IClGaugeFactory
    function createGauge(
        address pool
    ) external override returns (address gauge) {
        require(msg.sender == voter, "AUTH");
        require(getGauge[pool] == address(0), "GE");
        gauge = address(new GaugeV3(voter, nfpManager, feeCollector, pool));
        getGauge[pool] = gauge;
        emit GaugeCreated(pool, gauge);
    }
}

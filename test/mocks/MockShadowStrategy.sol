// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {
    IERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {
    IVaultFactory
} from "../../contracts-metropolis/src/interfaces/IVaultFactory.sol";
import {
    IStrategyCommon
} from "../../contracts-metropolis/src/interfaces/IStrategyCommon.sol";

/**
 * @title MockShadowStrategy
 * @dev Minimal mock implementation of Shadow strategy for testing
 */
contract MockShadowStrategy is IStrategyCommon {
    IVaultFactory private _factory;
    address private _vault;
    IERC20Upgradeable private _tokenX;
    IERC20Upgradeable private _tokenY;
    address private _pool;
    address private _operator;
    uint256 private _aumAnnualFee;
    bool private _hasPendingFee;
    uint256 private _pendingAumAnnualFee;
    uint256 private _lastRebalance;
    uint256 private _rebalanceCoolDown;

    constructor(address factory, address tokenX, address tokenY, address pool) {
        _factory = IVaultFactory(factory);
        _tokenX = IERC20Upgradeable(tokenX);
        _tokenY = IERC20Upgradeable(tokenY);
        _pool = pool;
        _operator = msg.sender;
        _aumAnnualFee = 100; // 1%
    }

    function initialize() external override {
        _vault = msg.sender;
    }

    function getFactory() external view override returns (IVaultFactory) {
        return _factory;
    }

    function getVault() external pure override returns (address) {
        return address(0x1234567890123456789012345678901234567890); // Mock vault address
    }

    function getTokenX() external pure override returns (IERC20Upgradeable) {
        return IERC20Upgradeable(0x1111111111111111111111111111111111111111); // Mock token X
    }

    function getTokenY() external pure override returns (IERC20Upgradeable) {
        return IERC20Upgradeable(0x2222222222222222222222222222222222222222); // Mock token Y
    }

    function getOperator() external view override returns (address) {
        return _operator;
    }

    function getStrategyType()
        external
        pure
        override
        returns (IVaultFactory.StrategyType)
    {
        return IVaultFactory.StrategyType.Shadow;
    }

    function getAumAnnualFee() external view override returns (uint256) {
        return _aumAnnualFee;
    }

    function getPendingAumAnnualFee()
        external
        view
        override
        returns (bool isSet, uint256 pendingAumAnnualFee)
    {
        return (_hasPendingFee, _pendingAumAnnualFee);
    }

    function setPendingAumAnnualFee(
        uint16 pendingAumAnnualFee
    ) external override {
        _hasPendingFee = true;
        _pendingAumAnnualFee = pendingAumAnnualFee;
    }

    function resetPendingAumAnnualFee() external override {
        _hasPendingFee = false;
        _pendingAumAnnualFee = 0;
    }

    function getBalances()
        external
        view
        override
        returns (uint256 amountX, uint256 amountY)
    {
        return (
            _tokenX.balanceOf(address(this)),
            _tokenY.balanceOf(address(this))
        );
    }

    function getIdleBalances()
        external
        view
        override
        returns (uint256 amountX, uint256 amountY)
    {
        return (
            _tokenX.balanceOf(address(this)),
            _tokenY.balanceOf(address(this))
        );
    }

    function getRewardTokens()
        external
        pure
        override
        returns (address[] memory)
    {
        address[] memory rewards = new address[](0);
        return rewards;
    }

    function hasRewards() external pure override returns (bool) {
        return false;
    }

    function hasExtraRewards() external pure override returns (bool) {
        return false;
    }

    function harvestRewards() external override {
        // No-op for mock
    }

    function getLastRebalance() external view override returns (uint256) {
        return _lastRebalance;
    }

    function setRebalanceCoolDown(uint256 coolDown) external override {
        _rebalanceCoolDown = coolDown;
    }

    function withdrawAll() external override {
        // Transfer all tokens to vault
        uint256 balanceX = _tokenX.balanceOf(address(this));
        uint256 balanceY = _tokenY.balanceOf(address(this));

        if (balanceX > 0) {
            _tokenX.transfer(_vault, balanceX);
        }
        if (balanceY > 0) {
            _tokenY.transfer(_vault, balanceY);
        }
    }

    function setOperator(address operator) external override {
        _operator = operator;
    }

    // Additional functions for pool access
    function getPool() external view returns (address) {
        return _pool;
    }
}

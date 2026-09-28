// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ImmutableClone} from "@arca/joe-v2/libraries/ImmutableClone.sol";

interface IMockVaultAdmin {
    function setStrategy(address newStrategy) external;
}

/**
 * @dev Deploys immutable-args clones the same way VaultFactory does, so tests
 * exercise the real vault and strategy contracts with production-accurate
 * immutable data.
 */
contract TestCloneDeployer {
    function cloneDeterministic(
        address implementation,
        bytes calldata data,
        bytes32 salt
    ) external returns (address) {
        return ImmutableClone.cloneDeterministic(implementation, data, salt);
    }
}

/**
 * @dev Minimal stand-in for VaultFactory: only the functions the vault and the
 * strategy call at runtime, plus a passthrough for the onlyFactory
 * setStrategy call.
 */
contract MockVaultFactoryLite {
    address private immutable _wnative;
    address private immutable _defaultOperator;

    constructor(address wnative_) {
        _wnative = wnative_;
        _defaultOperator = msg.sender;
    }

    function getWNative() external view returns (address) {
        return _wnative;
    }

    function getDefaultOperator() external view returns (address) {
        return _defaultOperator;
    }

    function getDepositToWithdrawCooldown() external pure returns (uint256) {
        return 0;
    }

    function isTransferIgnored(address) external pure returns (bool) {
        return false;
    }

    function getFeeRecipientByVault(address) external view returns (address) {
        return _defaultOperator;
    }

    function getShadowNonfungiblePositionManager()
        external
        pure
        returns (address)
    {
        return address(0);
    }

    function getShadowVoter() external pure returns (address) {
        return address(0);
    }

    function callSetStrategy(address vault, address strategy) external {
        IMockVaultAdmin(vault).setStrategy(strategy);
    }
}

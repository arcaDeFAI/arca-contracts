// SPDX-License-Identifier: GPL-3.0
import {IERC20Upgradeable} from "openzeppelin-upgradeable/token/ERC20/IERC20Upgradeable.sol";

pragma solidity 0.8.26;

import {IVaultFactory} from "./IVaultFactory.sol";

/**
 * @title Minimal Vault Interface
 * @author Arca
 * @notice Minimal interface that all vaults must implement for type identification and other basic functions.
 */
interface IMinimalVault {
    /**
     * @dev Returns the type of the vault
     * @return vaultType The type of vault, enum possibilities defined in IVaultFactory
     */
    function getVaultType() external view returns (IVaultFactory.VaultType vaultType);

    function setEmergencyMode() external;
    function recoverERC20(IERC20Upgradeable token, address recipient, uint256 amount) external;
}
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {IBaseVault} from "../../../contracts-metropolis/src/interfaces/IBaseVault.sol";
import {IRamsesV3Pool} from "../../CL/core/interfaces/IRamsesV3Pool.sol";

/**
 * @title Shadow Vault Interface
 * @author Arca
 * @notice Interface for Shadow (Ramses V3) vaults
 */
interface IShadowVault is IBaseVault {
    /**
     * @notice Returns the address of the Shadow pool.
     * @return The address of the pool.
     */
    function getPool() external pure returns (IRamsesV3Pool);
}

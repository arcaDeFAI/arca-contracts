// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IERC20Upgradeable} from "openzeppelin-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {ILBPair} from "joe-v2/interfaces/ILBPair.sol";

import {IMetropolisStrategy} from "./IMetropolisStrategy.sol";
import {IBaseVault} from "./IBaseVault.sol";
import {IAggregatorV3} from "./IAggregatorV3.sol";
import {IOracleHelper} from "./IOracleHelper.sol";

/**
 * @title Oracle Vault Interface
 * @author Trader Joe
 * @notice Interface used to interact with Liquidity Book Oracle Vaults
 */
interface IOracleVault is IBaseVault {
    
    error OracleVault__InvalidPrice();
    error OracleVault__StalePrice();

    error OracleVault__SequencerDown();
    error OracleVault__GracePeriodNotOver();
    error OracleVault__PriceDeviation();
    error OracleVault__InvalidInterval();
    error OracleVault__InvalidTimestamps();

    function getPrice() external view returns (uint256 price);

    function getOracleParameters() external view returns (IOracleHelper.OracleParameters memory parameters);

    function checkPriceInDeviation() external view returns (bool);

    function getOracleHelper() external view returns (IOracleHelper);
}

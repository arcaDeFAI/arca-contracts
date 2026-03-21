// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IBaseVault} from "./IBaseVault.sol";
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

    function getTwapInterval() external view returns (uint32);

    function setTwapInterval(uint32 twapInterval) external;

    function getDeviationThreshold() external view returns (uint256);

    function setDeviationThreshold(uint256 threshold) external;

    function checkPriceInDeviation() external view returns (bool);

    // Legacy: kept for backward compatibility with existing deployed vaults
    function getOracleHelper() external view returns (IOracleHelper);

    // Legacy: kept for backward compatibility
    function getOracleParameters()
        external
        view
        returns (IOracleHelper.OracleParameters memory parameters);
}

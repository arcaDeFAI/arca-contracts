// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IBaseVault} from "./IBaseVault.sol";

/**
 * @title Oracle Vault Interface
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
}

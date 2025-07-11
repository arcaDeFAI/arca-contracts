// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {Uint256x256Math} from "joe-v2/libraries/math/Uint256x256Math.sol";

import {BaseVault} from "./BaseVault.sol";
import {IStrategy} from "./interfaces/IStrategy.sol";
import {IOracleVault} from "./interfaces/IOracleVault.sol";
import {IVaultFactory} from "./interfaces/IVaultFactory.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {IOracleHelper} from "./interfaces/IOracleHelper.sol";

/**
 * @title Liquidity Book Oracle Vault contract
 * @author Trader Joe
 * @notice This contract is used to interact with the Liquidity Book Pair contract.
 * The two tokens of the pair has to have an oracle.
 * The oracle is used to get the price of the token X in token Y.
 * The price is used to value the balance of the strategy and mint shares accordingly.
 * The immutable data should be encoded as follow:
 * - 0x00: 20 bytes: The address of the LB pair.
 * - 0x14: 20 bytes: The address of the token X.
 * - 0x28: 20 bytes: The address of the token Y.
 * - 0x3C: 1 bytes: The decimals of the token X.
 * - 0x3D: 1 bytes: The decimals of the token Y.
 * - 0x3E: 20 bytes: The address of the oracle of the token X.
 * - 0x52: 20 bytes: The address of the oracle of the token Y.
 * - 0x66: 20 bytes: The address of the oracle helper.
 */
contract OracleVault is BaseVault, IOracleVault {
    using Uint256x256Math for uint256;

    /**
     * @dev Constructor of the contract.
     * @param factory Address of the factory.
     */
    constructor(IVaultFactory factory) BaseVault(factory) {}

    function _getOracleHelper() internal pure returns (IOracleHelper) {
        return IOracleHelper(_getArgAddress(102)); // Adjust offset based on your data layout
    }

    /**
     * @dev Returns the price of token X in token Y, in 128.128 binary fixed point format.
     * @return price The price of token X in token Y in 128.128 binary fixed point format.
     */
    function getPrice() external view override returns (uint256 price) {
        return _getOracleHelper().getPrice();
    }


    /**
     * @dev Returns the oracle parameters.
     * @return parameters The oracle parameters.
     */
    function getOracleParameters() external view returns (IOracleHelper.OracleParameters memory) {
        return _getOracleHelper().getOracleParameters();
    }

    /**
     * @dev Returns the oracle helper.
     * @return oracleHelper The oracle helper.
     */
    function getOracleHelper() external pure override returns (IOracleHelper) {
        return _getOracleHelper();
    }


    /**
     * @dev Returns the shares that will be minted when depositing `expectedAmountX` of token X and
     * `expectedAmountY` of token Y. The effective amounts will never be greater than the input amounts.
     * @param strategy The strategy to deposit to.
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     * @return shares The amount of shares that will be minted.
     * @return effectiveX The effective amount of token X that will be deposited.
     * @return effectiveY The effective amount of token Y that will be deposited.
     */
    function _previewShares(
        IStrategy strategy,
        uint256 amountX,
        uint256 amountY
    )
        internal
        view
        override
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY)
    {
        if (amountX == 0 && amountY == 0) return (0, 0, 0);

        // the price is in quoteToken
        uint256 price = _getOracleHelper().getPrice();

        // check if the price is within the allowed deviation
        _getOracleHelper().checkPriceInDeviation(); // will revert if not within deviation

        uint256 totalShares = totalSupply();

        uint256 valueInY = _getOracleHelper().getValueInY(price, amountX, amountY);

        if (totalShares == 0) {
            return (valueInY * _SHARES_PRECISION, amountX, amountY);
        }

        (uint256 totalX, uint256 totalY) = _getBalances(strategy);
        uint256 totalValueInY = _getOracleHelper().getValueInY(price, totalX, totalY);

        shares = valueInY.mulDivRoundDown(totalShares, totalValueInY);

        return (shares, amountX, amountY);
    }


    function checkPriceInDeviation() external view returns (bool) {
        return _getOracleHelper().checkPriceInDeviation();
    }


    function _updatePool() internal virtual override {}

    function _modifyUser(
        address user,
        int256 amount
    ) internal virtual override {}

    function _beforeEmergencyMode() internal virtual override {}

}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {Uint256x256Math} from "@arca/joe-v2/libraries/math/Uint256x256Math.sol";

import {BaseVault} from "./BaseVault.sol";
import {MetropolisPriceHelper} from "./libraries/MetropolisPriceHelper.sol";
import {IMetropolisStrategy} from "./interfaces/IMetropolisStrategy.sol";
import {IOracleVault} from "./interfaces/IOracleVault.sol";
import {IVaultFactory} from "./interfaces/IVaultFactory.sol";

/**
 * @title Liquidity Book Oracle Vault contract
 * @notice Oracle vault that reads price directly from the LB pair.
 * Works with any token pair regardless of decimals.
 * The immutable data should be encoded as follow:
 * - 0x00: 20 bytes: The address of the LB pair.
 * - 0x14: 20 bytes: The address of the token X.
 * - 0x28: 20 bytes: The address of the token Y.
 * - 0x3C: 1 bytes: The decimals of the token X.
 * - 0x3D: 1 bytes: The decimals of the token Y.
 */
contract OracleVault is BaseVault, IOracleVault {
    using Uint256x256Math for uint256;

    /// @notice TWAP interval in seconds (0 = use spot price)
    uint32 internal _twapInterval;

    /// @notice Max allowed deviation between spot and TWAP (percentage, e.g. 5 = 5%)
    uint256 internal _deviationThreshold;

    /**
     * @dev Constructor of the contract.
     * @param factory Address of the factory.
     */
    constructor(IVaultFactory factory) BaseVault(factory) {}

    /**
     * @dev Returns the price of token X in token Y, in 128.128 binary fixed point format.
     * @return price The price of token X in token Y in 128.128 binary fixed point format.
     */
    function getPrice() external view override returns (uint256 price) {
        return _getPrice();
    }

    /**
     * @dev Returns the TWAP interval.
     */
    function getTwapInterval() external view override returns (uint32) {
        return _twapInterval;
    }

    /**
     * @dev Sets the TWAP interval. Only callable by the factory.
     * @param twapInterval The new TWAP interval in seconds (0 = spot price only).
     */
    function setTwapInterval(
        uint32 twapInterval
    ) external override onlyFactory {
        _twapInterval = twapInterval;
    }

    /**
     * @dev Returns the deviation threshold.
     */
    function getDeviationThreshold() external view override returns (uint256) {
        return _deviationThreshold;
    }

    /**
     * @dev Sets the deviation threshold. Only callable by the factory.
     * @param threshold The maximum deviation percentage (e.g. 5 = 5%).
     */
    function setDeviationThreshold(
        uint256 threshold
    ) external override onlyFactory {
        _deviationThreshold = threshold;
    }

    /**
     * @dev Returns the type of the vault.
     * @return vaultType The type of the vault
     */
    function getVaultType()
        public
        pure
        virtual
        override
        returns (IVaultFactory.VaultType)
    {
        return IVaultFactory.VaultType.Oracle;
    }

    /**
     * @dev Checks if the current spot price is within deviation of the TWAP.
     * @return True if price is within deviation (or if TWAP check is disabled).
     */
    function checkPriceInDeviation() external view returns (bool) {
        _checkPriceDeviation();
        return true;
    }

    /**
     * @dev Returns the 128.128 price of token X in token Y.
     * Virtual so subclasses can override to use an external oracle.
     */
    function _getPrice() internal view virtual returns (uint256) {
        return MetropolisPriceHelper.getPrice(_pair(), _twapInterval);
    }

    /**
     * @dev Validates that spot price is within deviation of TWAP.
     * Virtual so subclasses can override with cross-source validation
     * (e.g. external oracle vs LB pair).
     */
    function _checkPriceDeviation() internal view virtual {
        MetropolisPriceHelper.checkPriceDeviation(
            _pair(),
            _twapInterval,
            _deviationThreshold
        );
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
        IMetropolisStrategy strategy,
        uint256 amountX,
        uint256 amountY
    )
        internal
        view
        override
        returns (uint256 shares, uint256 effectiveX, uint256 effectiveY)
    {
        if (amountX == 0 && amountY == 0) return (0, 0, 0);

        uint256 price = _getPrice();

        _checkPriceDeviation();

        uint256 totalShares = totalSupply();

        uint256 valueInY = MetropolisPriceHelper.getValueInY(
            price,
            amountX,
            amountY
        );

        if (totalShares == 0) {
            return (valueInY * _SHARES_PRECISION, amountX, amountY);
        }

        (uint256 totalX, uint256 totalY) = _getBalances(strategy);
        uint256 totalValueInY = MetropolisPriceHelper.getValueInY(
            price,
            totalX,
            totalY
        );

        shares = valueInY.mulDivRoundDown(totalShares, totalValueInY);

        return (shares, amountX, amountY);
    }

    function _updatePool() internal virtual override {}

    function _modifyUser(
        address user,
        int256 amount
    ) internal virtual override {}

    function _beforeEmergencyMode() internal virtual override {}
}

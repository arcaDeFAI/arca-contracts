// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {
    IOracleHelper
} from "../../contracts-metropolis/src/interfaces/IOracleHelper.sol";
import {
    IAggregatorV3
} from "../../contracts-metropolis/src/interfaces/IAggregatorV3.sol";

/**
 * @title MockOracleHelper
 * @dev Mock implementation of IOracleHelper for testing
 */
contract MockOracleHelper is IOracleHelper {
    bool private _initialized;
    address private _vault;
    uint256 private _price;
    bool private _priceInDeviation = true;
    OracleParameters private _oracleParameters;
    IAggregatorV3 private _sequencerUptimeFeed;
    IAggregatorV3 private _dataFeedX;
    IAggregatorV3 private _dataFeedY;

    // Test configuration
    uint8 private _decimalsX = 18;
    uint8 private _decimalsY = 6;

    constructor(uint256 initialPrice) {
        _price = initialPrice;
    }

    function initialize(
        address vault,
        uint24 heartbeatX,
        uint24 heartbeatY,
        uint256 minPrice,
        uint256 maxPrice,
        IAggregatorV3 sequencerUptimeFeed
    ) external override {
        if (_initialized) revert OracleHelper__AlreadyInitialized();

        _vault = vault;
        _sequencerUptimeFeed = sequencerUptimeFeed;
        _oracleParameters = OracleParameters({
            minPrice: minPrice,
            maxPrice: maxPrice,
            heartbeatX: heartbeatX,
            heartbeatY: heartbeatY,
            deviationThreshold: 500, // 5% default
            twapPriceCheckEnabled: false,
            twapInterval: 0
        });
        _initialized = true;
    }

    function setOracleParameters(
        OracleParameters calldata parameters
    ) external override {
        if (!_initialized) revert OracleHelper__NotInitialized();
        _oracleParameters = parameters;
    }

    function setSequencerUptimeFeed(
        IAggregatorV3 sequencerUptimeFeed
    ) external override {
        _sequencerUptimeFeed = sequencerUptimeFeed;
    }

    function setTwapParams(
        bool enabled,
        uint40 interval,
        uint256 deviationThreshold
    ) external override {
        _oracleParameters.twapPriceCheckEnabled = enabled;
        _oracleParameters.twapInterval = interval;
        _oracleParameters.deviationThreshold = deviationThreshold;
    }

    function checkPriceInDeviation() external view override returns (bool) {
        if (!_initialized) revert OracleHelper__NotInitialized();
        return _priceInDeviation;
    }

    function getPrice() external view override returns (uint256 price) {
        if (!_initialized) revert OracleHelper__NotInitialized();
        return _price;
    }

    function getDataFeedX() external view override returns (IAggregatorV3) {
        return _dataFeedX;
    }

    function getDataFeedY() external view override returns (IAggregatorV3) {
        return _dataFeedY;
    }

    function getValueInY(
        uint256 price,
        uint256 amountX,
        uint256 amountY
    ) external view override returns (uint256 valueInY) {
        // Convert X to Y value using the provided price
        // Price is assumed to be scaled to give Y units per X unit
        uint256 amountXInY = (amountX * price) / (10 ** _decimalsX);
        return amountXInY + amountY;
    }

    function getOracleParameters()
        external
        view
        override
        returns (OracleParameters memory)
    {
        return _oracleParameters;
    }

    function getSequencerUptimeFeed()
        external
        view
        override
        returns (IAggregatorV3)
    {
        return _sequencerUptimeFeed;
    }

    // ============ Test Helper Functions ============

    /**
     * @dev Set the mock price for testing
     */
    function setPrice(uint256 newPrice) external {
        _price = newPrice;
    }

    /**
     * @dev Set whether price is within deviation for testing
     */
    function setPriceInDeviation(bool inDeviation) external {
        _priceInDeviation = inDeviation;
    }

    /**
     * @dev Set token decimals for testing
     */
    function setTokenDecimals(uint8 decimalsX, uint8 decimalsY) external {
        _decimalsX = decimalsX;
        _decimalsY = decimalsY;
    }

    /**
     * @dev Set data feeds for testing
     */
    function setDataFeeds(
        IAggregatorV3 dataFeedX,
        IAggregatorV3 dataFeedY
    ) external {
        _dataFeedX = dataFeedX;
        _dataFeedY = dataFeedY;
    }

    /**
     * @dev Check if initialized
     */
    function isInitialized() external view returns (bool) {
        return _initialized;
    }

    /**
     * @dev Get vault address
     */
    function getVault() external view returns (address) {
        return _vault;
    }
}

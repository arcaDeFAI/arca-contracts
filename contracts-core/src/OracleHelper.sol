// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {ILBPair} from "@arca/joe-v2/interfaces/ILBPair.sol";
import {Uint256x256Math} from "@arca/joe-v2/libraries/math/Uint256x256Math.sol";
import {IOracleVault} from "./interfaces/IOracleVault.sol";
import {IOracleHelper} from "./interfaces/IOracleHelper.sol";

contract OracleHelper is IOracleHelper {
    using Uint256x256Math for uint256;

    uint8 private constant _PRICE_OFFSET = 128;
    uint256 private constant GRACE_PERIOD_TIME = 3600;

    /// @notice The LBPair contract
    ILBPair private immutable _pair;

    /// @notice The data feed for token X
    IAggregatorV3 private immutable _dataFeedX;

    /// @notice The data feed for token Y
    IAggregatorV3 private immutable _dataFeedY;

    /// @notice The decimals of token X
    uint8 private immutable _decimalsX;

    /// @notice The decimals of token Y
    uint8 private immutable _decimalsY;

    /// @notice The factory address
    address private immutable _factory;

    /// @notice The vault address
    address private _vault;

    /// @notice Whether the oracle helper is initialized
    bool private _initialized;

    /// @notice Oracle parameters
    IOracleHelper.OracleParameters private _oracleParameters;

    /// @notice Sequencer uptime feed
    IAggregatorV3 private _sequencerUptimeFeed;

    constructor(
        address factory,
        ILBPair pair,
        IAggregatorV3 dataFeedX,
        IAggregatorV3 dataFeedY,
        uint8 decimalsX,
        uint8 decimalsY
    ) {
        _factory = factory;
        _pair = pair;
        _dataFeedX = dataFeedX;
        _dataFeedY = dataFeedY;
        _decimalsX = decimalsX;
        _decimalsY = decimalsY;
    }

    function initialize(
        address vault,
        uint24 heartbeatX,
        uint24 heartbeatY,
        uint256 minPrice,
        uint256 maxPrice,
        IAggregatorV3 sequencerUptimeFeed
    ) external onlyFactory {
        if (_initialized) revert OracleHelper__AlreadyInitialized();
        if (vault == address(0)) revert OracleHelper__InvalidVault();

        _vault = vault;
        _initialized = true;

        _oracleParameters = OracleParameters({
            minPrice: minPrice,
            maxPrice: maxPrice,
            heartbeatX: heartbeatX,
            heartbeatY: heartbeatY,
            deviationThreshold: 0,
            twapPriceCheckEnabled: false,
            twapInterval: 0
        });

        _sequencerUptimeFeed = sequencerUptimeFeed;
    }

    modifier onlyVault() {
        if (msg.sender != _vault) revert OracleHelper__NotInitialized();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != _factory) revert OracleHelper__NotFactory();
        _;
    }

    function setSequencerUptimeFeed(
        IAggregatorV3 sequencerUptimeFeed
    ) external override onlyFactory {
        _sequencerUptimeFeed = sequencerUptimeFeed;
    }

    function getOracleParameters()
        external
        view
        override
        returns (OracleParameters memory)
    {
        return _oracleParameters;
    }

    function setOracleParameters(
        OracleParameters calldata parameters
    ) external override onlyFactory {
        if (parameters.minPrice > parameters.maxPrice)
            revert IOracleVault.OracleVault__InvalidPrice();
        _oracleParameters = parameters;
    }

    function setTwapParams(
        bool enabled,
        uint40 interval,
        uint256 deviationThreshold
    ) external override onlyFactory {
        _oracleParameters.twapPriceCheckEnabled = enabled;
        _oracleParameters.twapInterval = interval;
        _oracleParameters.deviationThreshold = deviationThreshold;
    }

    function _getOraclePrice(
        IAggregatorV3 dataFeed
    ) internal view returns (uint256 uintPrice) {
        _checkSequencerUp();

        (, int256 price, , uint256 updatedAt, ) = dataFeed.latestRoundData();

        uint24 heartbeat = dataFeed == _dataFeedX
            ? _oracleParameters.heartbeatX
            : _oracleParameters.heartbeatY;

        if (updatedAt == 0 || updatedAt + heartbeat < block.timestamp) {
            revert IOracleVault.OracleVault__StalePrice();
        }

        if (
            uint256(price) < _oracleParameters.minPrice ||
            uint256(price) > _oracleParameters.maxPrice
        ) {
            revert IOracleVault.OracleVault__InvalidPrice();
        }

        uintPrice = uint256(price);
    }

    function _checkSequencerUp() internal view {
        if (address(_sequencerUptimeFeed) == address(0)) {
            return;
        }

        (, int256 answer, uint256 startedAt, , ) = _sequencerUptimeFeed
            .latestRoundData();

        bool isSequencerUp = answer == 0;
        if (!isSequencerUp) {
            revert IOracleVault.OracleVault__SequencerDown();
        }

        uint256 timeSinceUp = block.timestamp - startedAt;
        if (timeSinceUp <= GRACE_PERIOD_TIME) {
            revert IOracleVault.OracleVault__GracePeriodNotOver();
        }
    }

    function getDataFeedX() external view override returns (IAggregatorV3) {
        return _dataFeedX;
    }

    function getDataFeedY() external view override returns (IAggregatorV3) {
        return _dataFeedY;
    }

    function getSequencerUptimeFeed()
        external
        view
        override
        returns (IAggregatorV3)
    {
        return _sequencerUptimeFeed;
    }

    function getPrice() external view override returns (uint256 price) {
        uint256 scaledPriceX = _getOraclePrice(_dataFeedX) * 10 ** _decimalsY;
        uint256 scaledPriceY = _getOraclePrice(_dataFeedY) * 10 ** _decimalsX;

        price = scaledPriceX.mulDivRoundDown(1 << _PRICE_OFFSET, scaledPriceY);

        if (price == 0) revert IOracleVault.OracleVault__InvalidPrice();
    }

    /**
     * @dev Returns the value of amounts in token Y.
     * @param price The price of token X in token Y.
     * @param amountX The amount of token X.
     * @param amountY The amount of token Y.
     * @return valueInY The value of amounts in token Y.
     */
    function getValueInY(
        uint256 price,
        uint256 amountX,
        uint256 amountY
    ) external pure override returns (uint256 valueInY) {
        uint256 amountXInY = price.mulShiftRoundDown(amountX, _PRICE_OFFSET);
        return amountXInY + amountY;
    }

    function checkPriceInDeviation() external view override returns (bool) {
        uint256 price = this.getPrice();
        _checkPrice(price);
        return true;
    }

    function _checkPrice(uint256 spotPriceInY) internal view {
        if (!_oracleParameters.twapPriceCheckEnabled) return;

        uint40 twapStart = uint40(
            block.timestamp - _oracleParameters.twapInterval
        );
        uint40 twapEnd = uint40(block.timestamp);

        if (twapEnd <= twapStart)
            revert IOracleVault.OracleVault__InvalidTimestamps();

        (uint64 cumulativeId1, , ) = _pair.getOracleSampleAt(twapStart);
        (uint64 cumulativeId2, , ) = _pair.getOracleSampleAt(twapEnd);

        uint40 timeElapsed = twapEnd - twapStart;
        uint256 twapBinId = (cumulativeId2 - cumulativeId1) / timeElapsed;
        uint256 twapPriceInY = _pair.getPriceFromId(uint24(twapBinId));

        uint256 deviationThreshold = _oracleParameters.deviationThreshold;
        if (
            spotPriceInY > (twapPriceInY * (100 + deviationThreshold)) / 100 ||
            spotPriceInY < (twapPriceInY * (100 - deviationThreshold)) / 100
        ) {
            revert IOracleVault.OracleVault__PriceDeviation();
        }
    }
}

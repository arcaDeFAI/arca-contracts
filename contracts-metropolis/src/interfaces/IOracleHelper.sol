// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IAggregatorV3} from "./IAggregatorV3.sol";

interface IOracleHelper {

    struct OracleParameters {
        uint256 minPrice;
        uint256 maxPrice;
        uint24 heartbeatX;
        uint24 heartbeatY;
        uint256 deviationThreshold;
        bool twapPriceCheckEnabled;
        uint40 twapInterval;
    }

    error OracleHelper__AlreadyInitialized();
    error OracleHelper__NotInitialized();
    error OracleHelper__InvalidVault();
    error OracleHelper__NotFactory();

    function initialize(address vault, uint24 heartbeatX, uint24 heartbeatY, uint256 minPrice, uint256 maxPrice, IAggregatorV3 sequencerUptimeFeed) external;

    function setOracleParameters(OracleParameters calldata parameters) external;

    function setSequenzerUptimeFeed(IAggregatorV3 sequencerUptimeFeed) external;

    function setTwapParams(bool enabled, uint40 interval, uint256 deviationThreshold) external;

    function checkPriceInDeviation() external view returns (bool);

    function getPrice() external view returns (uint256 price);

    function getDataFeedX() external view returns (IAggregatorV3);

    function getDataFeedY() external view returns (IAggregatorV3);

     function getValueInY(
        uint256 price,
        uint256 amountX,
        uint256 amountY
    ) external view returns (uint256 valueInY);

    function getOracleParameters() external view returns (OracleParameters memory);

    function getSequenzerUptimeFeed() external view returns (IAggregatorV3);
}
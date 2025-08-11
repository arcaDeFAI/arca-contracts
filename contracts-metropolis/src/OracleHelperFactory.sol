// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {IOracleHelper} from "./interfaces/IOracleHelper.sol";
import {OracleHelper} from "./OracleHelper.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {ILBPair} from "@arca/joe-v2/interfaces/ILBPair.sol";
import {IOracleHelperFactory} from "./interfaces/IOracleHelperFactory.sol";

contract OracleHelperFactory is IOracleHelperFactory {

    function createOracleHelper(address factory,
        ILBPair pair,
        IAggregatorV3 dataFeedX,
        IAggregatorV3 dataFeedY,
        uint8 decimalsX,
        uint8 decimalsY) external returns (IOracleHelper) {
        return new OracleHelper(
            factory,
            pair,
            dataFeedX,
            dataFeedY,
            decimalsX,
            decimalsY
        );
    }

}
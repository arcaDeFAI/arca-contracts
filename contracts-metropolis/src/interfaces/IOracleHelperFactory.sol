// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {IOracleHelper} from "./IOracleHelper.sol";
import {IAggregatorV3} from "./IAggregatorV3.sol";
import {ILBPair} from "@arca/joe-v2/interfaces/ILBPair.sol";

interface IOracleHelperFactory {
    function createOracleHelper(
        address factory,
        ILBPair pair,
        IAggregatorV3 dataFeedX,
        IAggregatorV3 dataFeedY,
        uint8 decimalsX,
        uint8 decimalsY
    ) external returns (IOracleHelper);
}

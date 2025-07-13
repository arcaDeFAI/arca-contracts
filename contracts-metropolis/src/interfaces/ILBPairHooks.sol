// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

interface ILBPairHooks {
    function getLBHooksParameters() external view returns (bytes32 hooksParameters);
}

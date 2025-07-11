// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {IERC20} from "joe-v2/interfaces/ILBPair.sol";

interface IHooksRewarder {
    function getRewardToken() external view returns (IERC20);

    function getLBHooksManager() external view returns (address);

    function isStopped() external view returns (bool);

    function getRewardedRange() external view returns (uint256 binStart, uint256 binEnd);

    function getPendingRewards(address user, uint256[] calldata ids) external view returns (uint256 pendingRewards);

    function claim(address user, uint256[] calldata ids) external;

    function getExtraHooksParameters() external view returns (bytes32 extraHooksParameters);
}

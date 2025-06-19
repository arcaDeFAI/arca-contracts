// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

contract MockLBHooksBaseRewarder {
    IERC20 public rewardToken;
    uint256 private claimAmount;

    constructor() {}

    function setRewardToken(address _rewardToken) external {
        rewardToken = IERC20(_rewardToken);
    }

    function setClaimAmount(uint256 _amount) external {
        claimAmount = _amount;
    }

    function claim(address user, uint256[] calldata /* binIds */) external {
        if (claimAmount > 0 && address(rewardToken) != address(0)) {
            // Transfer reward tokens to the claimer
            rewardToken.transfer(user, claimAmount);
        }
    }

    // Additional functions that might be needed
    function pendingRewards(address user, uint256[] calldata binIds) external view returns (uint256) {
        return claimAmount;
    }
}
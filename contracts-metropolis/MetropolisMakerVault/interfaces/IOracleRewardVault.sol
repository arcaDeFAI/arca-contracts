// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {IOracleVault} from "./IOracleVault.sol";
import {IERC20} from "../../../lib/joe-v2/src/interfaces/ILBPair.sol";

/**
 * @title Oracle Reard Vault Interface
 * @author BlueLabs
 * @notice Interface used to interact with Liquidity Book Oracle Vaults
 */
interface IOracleRewardVault is IOracleVault {

    struct User {
        uint256 phantomAmount;
        mapping(address => uint256) rewardDebtPerToken;
    }

    struct Reward {
        IERC20 token;
        uint256 lastRewardBalance;
        uint256 accRewardsPerShare;
    }

    struct UserReward {
        IERC20 token;
        uint256 pendingRewards;
    }

    struct UserInfo {
        uint256 phantomAmount;
        RewardDebtInfo[] rewardDebtInfo;
    }

    struct RewardDebtInfo {
        IERC20 token;
        uint256 rewardDebt;
    }

    event PoolUpdated(uint256 indexed timestamp, uint256 indexed accRewardShare);
    event Harvested(address indexed user, address indexed token, uint256 amount);

    function getUserInfo(address user) external view returns (UserInfo memory);

    function getPendingRewards(address _user)
        external
        view
        returns (UserReward[] memory rewards);


    function claim() external;

    function notifyRewardToken(IERC20 token) external;

    function updateAccRewardsPerShare() external;
}

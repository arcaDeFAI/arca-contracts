// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.26;

import {Uint256x256Math} from "../../contracts-metropolis/lib/joe-v2/src/libraries/math/Uint256x256Math.sol";

import {OracleShadowVault} from "./OracleShadowVault.sol";
import {IStrategyCommon} from "../../contracts-metropolis/src/interfaces/IStrategyCommon.sol";
import {IOracleRewardVault} from "../../contracts-metropolis/src/interfaces/IOracleRewardVault.sol";
import {IVaultFactory} from "../../contracts-metropolis/src/interfaces/IVaultFactory.sol";
import {IAggregatorV3} from "../../contracts-metropolis/src/interfaces/IAggregatorV3.sol";
import {IERC20} from "../../contracts-metropolis/src/interfaces/IHooksRewarder.sol";

import {TokenHelper} from "../../contracts-metropolis/src/libraries/TokenHelper.sol";
import {Precision} from "../../contracts-metropolis/src/libraries/Precision.sol";

/**
 * @title Shadow Oracle Reward Vault contract
 * @author Arca
 * @notice This contract is used to interact with Shadow (Ramses V3) pools with reward distribution.
 */
contract OracleRewardShadowVault is OracleShadowVault, IOracleRewardVault {
    using Uint256x256Math for uint256;
    using Precision for uint256;

    // New constant for phantom share scaling
    uint256 private constant PHANTOM_SHARE_PRECISION = 1e18; // 18 decimals for phantom shares

    /// @notice Phantom share supply with lower decimals
    uint256 private _phantomShareSupply;

    /// @notice User data
    mapping(address => User) private _users;

    mapping(address => bool) private tokenCached;
    Reward[] private cachedRewardTokens;

    /**
     * @dev Constructor of the contract.
     * @param factory Address of the factory.
     */
    constructor(IVaultFactory factory) OracleShadowVault(factory) {}


    function getUserInfo(address user) external view override returns (UserInfo memory userInfo) {
        userInfo.phantomAmount = _users[user].phantomAmount;
        userInfo.rewardDebtInfo = new RewardDebtInfo[](cachedRewardTokens.length);
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            userInfo.rewardDebtInfo[i] = RewardDebtInfo({
                token: reward.token,
                rewardDebt: _users[user].rewardDebtPerToken[address(reward.token)]
            });
        }
        return userInfo;
    }

    function getPendingRewards(address user) external view override returns (UserReward[] memory rewards) {
        rewards = new UserReward[](cachedRewardTokens.length);
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            (uint256 calcAccRewardsPerShare,) = _getAccRewardsPerShare(reward);
            rewards[i] = UserReward({
                token: reward.token,
                pendingRewards: _calcPending(user, reward, calcAccRewardsPerShare)
            });   
        }
    }

    function _getAccRewardsPerShare(Reward storage reward) internal view returns (uint256 calcAccRewardsPerShare, uint256 rewardBalance) {
        if (address(getStrategy()) == address(0)) {
            return (reward.accRewardsPerShare, reward.lastRewardBalance);
        }

        rewardBalance = TokenHelper.safeBalanceOf(reward.token, address(this));
        if (reward.token == _pool().token0()) {
            rewardBalance -= _totalAmountX;
        } else if (reward.token == _pool().token1()) {
            rewardBalance -= _totalAmountY;
        }

        uint256 lastRewardBalance = reward.lastRewardBalance;
        calcAccRewardsPerShare = reward.accRewardsPerShare;

        // recompute accRewardsPerShare if not up to date
        if (
            reward.lastRewardBalance != rewardBalance && _phantomShareSupply > 0
        ) {
            uint256 accruedReward = rewardBalance > lastRewardBalance
                ? rewardBalance - lastRewardBalance
                : 0;

            if (accruedReward > 0) {
                calcAccRewardsPerShare =
                    calcAccRewardsPerShare +
                    ((accruedReward.shiftPrecision()) / _phantomShareSupply);
            }
        }
    }

    function _calcPending(address user, Reward storage reward, uint256 calcAccRewardsPerShare) internal view returns (uint256) {
        return _users[user].phantomAmount > 0 ? (_users[user].phantomAmount * calcAccRewardsPerShare).unshiftPrecision() - _users[user].rewardDebtPerToken[address(reward.token)] : 0;
    }

    /** 
     * @dev Must be called by the strategy and before reward transfer happens
     * @param token The reward token
     */
    function notifyRewardToken(IERC20 token) external {
        if (address(getStrategy()) != msg.sender) revert BaseVault__OnlyStrategy();
        _notifyRewardToken(token);
    }

    function _notifyRewardToken(IERC20 token) internal {
        if (!tokenCached[address(token)]) {
            tokenCached[address(token)] = true;
            cachedRewardTokens.push(Reward({
                token: token,
                lastRewardBalance: 0,
                accRewardsPerShare: 0
            }));
        }
    }

    function updateAccRewardsPerShare() public {
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            (uint256 accRewardsPerShare, uint256 rewardBalance) = _getAccRewardsPerShare(reward);

            reward.accRewardsPerShare = accRewardsPerShare;
            reward.lastRewardBalance = rewardBalance;
            emit PoolUpdated(block.timestamp, accRewardsPerShare);
        }
    }

    function _updatePool() internal override {
        if (address(getStrategy()) != address(0)) {
            if (getStrategy().hasRewards()) _notifyRewardToken(getStrategy().getRewardToken());
            if (getStrategy().hasExtraRewards()) _notifyRewardToken(getStrategy().getExtraRewardToken());
            
            try getStrategy().harvestRewards() {} catch {
                // silently fail if no rewards are available
            }
        }
        updateAccRewardsPerShare();
    }

    /**
     * @dev will be called on base vault deposit and withdrawal
     * @param user The address of the user.
     * @param amount The amount of shares to be minted or burned.
     */
    function _modifyUser(address user, int256 amount) internal override {
        if (amount == 0) return;

        // Claim pending rewards before modifying user balance
        _claimPendingRewards(user);

        if (amount > 0) {
            uint256 uAmount = uint256(amount);
            uint256 phantomShares = (uAmount * PHANTOM_SHARE_PRECISION) / _SHARES_PRECISION;
            
            _users[user].phantomAmount += phantomShares;
            _phantomShareSupply += phantomShares;
        } else {
            uint256 uAmount = uint256(-amount);
            uint256 phantomShares = (uAmount * PHANTOM_SHARE_PRECISION) / _SHARES_PRECISION;
            
            _users[user].phantomAmount -= phantomShares;
            _phantomShareSupply -= phantomShares;
        }
    }

    function _claimPendingRewards(address user) internal {
        uint256 userPhantomAmount = _users[user].phantomAmount;
        if (userPhantomAmount == 0) return;

        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            uint256 pendingReward = _calcPending(user, reward, reward.accRewardsPerShare);
            
            if (pendingReward > 0) {
                reward.token.transfer(user, pendingReward);
                emit RewardsClaimed(user, address(reward.token), pendingReward);
            }
            
            _users[user].rewardDebtPerToken[address(reward.token)] = 
                (userPhantomAmount * reward.accRewardsPerShare).unshiftPrecision();
        }
    }

    /**
     * @notice Claims all pending rewards for the caller
     */
    function claimRewards() external {
        _updatePool();
        _claimPendingRewards(msg.sender);
    }

    function _beforeEmergencyMode() internal override {
        // Claim rewards for all users would be too gas intensive
        // Users can still claim their rewards after emergency mode
    }

    function _rewardX() internal view override returns (uint256) {
        uint256 totalRewardX = 0;
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            if (cachedRewardTokens[i].token == _tokenX()) {
                totalRewardX = cachedRewardTokens[i].lastRewardBalance;
                break;
            }
        }
        return totalRewardX;
    }

    function _rewardY() internal view override returns (uint256) {
        uint256 totalRewardY = 0;
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            if (cachedRewardTokens[i].token == _tokenY()) {
                totalRewardY = cachedRewardTokens[i].lastRewardBalance;
                break;
            }
        }
        return totalRewardY;
    }
}
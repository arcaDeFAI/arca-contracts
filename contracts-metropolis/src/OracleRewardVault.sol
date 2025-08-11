// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {Uint256x256Math} from "joe-v2/libraries/math/Uint256x256Math.sol";

import {OracleVault} from "./OracleVault.sol";
import {IMetropolisStrategy} from "./interfaces/IMetropolisStrategy.sol";
import {IOracleRewardVault} from "./interfaces/IOracleRewardVault.sol";
import {IVaultFactory} from "./interfaces/IVaultFactory.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {IERC20} from "./interfaces/IHooksRewarder.sol";
import {
    IMinimalVault
} from "../../contracts-metropolis/src/interfaces/IMinimalVault.sol";
import {TokenHelper} from "./libraries/TokenHelper.sol";
import {Precision} from "./libraries/Precision.sol";

/**
 * @title Liquidity Book Oracle Reward Vault contract
 * @author BlueLabs
 * @notice This contract is used to interact with the Liquidity Book Pair contract.
 */
contract OracleRewardVault is OracleVault, IOracleRewardVault {
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
    constructor(IVaultFactory factory) OracleVault(factory) {}

    /**
     * @dev Returns the type of the vault.
     * @return vaultType The type of the vault
     */
    function getVaultType()
        public
        pure
        virtual
        override(OracleVault, IMinimalVault)
        returns (IVaultFactory.VaultType)
    {
        return IVaultFactory.VaultType.OracleReward;
    }

    function getUserInfo(
        address user
    ) external view override returns (UserInfo memory userInfo) {
        userInfo.phantomAmount = _users[user].phantomAmount;
        userInfo.rewardDebtInfo = new RewardDebtInfo[](
            cachedRewardTokens.length
        );
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            userInfo.rewardDebtInfo[i] = RewardDebtInfo({
                token: reward.token,
                rewardDebt: _users[user].rewardDebtPerToken[
                    address(reward.token)
                ]
            });
        }
        return userInfo;
    }

    function getPendingRewards(
        address user
    ) external view override returns (UserReward[] memory rewards) {
        rewards = new UserReward[](cachedRewardTokens.length);
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            (uint256 calcAccRewardsPerShare, ) = _getAccRewardsPerShare(reward);
            rewards[i] = UserReward({
                token: reward.token,
                pendingRewards: _calcPending(
                    user,
                    reward,
                    calcAccRewardsPerShare
                )
            });
        }
    }

    function _getAccRewardsPerShare(
        Reward storage reward
    )
        internal
        view
        returns (uint256 calcAccRewardsPerShare, uint256 rewardBalance)
    {
        if (address(getStrategy()) == address(0)) {
            return (reward.accRewardsPerShare, reward.lastRewardBalance);
        }

        rewardBalance = TokenHelper.safeBalanceOf(reward.token, address(this));
        if (reward.token == _pair().getTokenX()) {
            rewardBalance -= _totalAmountX;
        } else if (reward.token == _pair().getTokenY()) {
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

    function _calcPending(
        address user,
        Reward storage reward,
        uint256 calcAccRewardsPerShare
    ) internal view returns (uint256) {
        return
            _users[user].phantomAmount > 0
                ? (_users[user].phantomAmount * calcAccRewardsPerShare)
                    .unshiftPrecision() -
                    _users[user].rewardDebtPerToken[address(reward.token)]
                : 0;
    }

    /**
     * @dev Must be called by the strategy and before reward transfer happens
     * @param token The reward token
     */
    function notifyRewardToken(IERC20 token) external {
        if (address(getStrategy()) != msg.sender)
            revert BaseVault__OnlyStrategy();
        _notifyRewardToken(token);
    }

    function _notifyRewardToken(IERC20 token) internal {
        if (!tokenCached[address(token)]) {
            tokenCached[address(token)] = true;
            cachedRewardTokens.push(
                Reward({
                    token: token,
                    lastRewardBalance: 0,
                    accRewardsPerShare: 0
                })
            );
        }
    }

    function updateAccRewardsPerShare() public {
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            (
                uint256 accRewardsPerShare,
                uint256 rewardBalance
            ) = _getAccRewardsPerShare(reward);

            reward.accRewardsPerShare = accRewardsPerShare;
            reward.lastRewardBalance = rewardBalance;
            emit PoolUpdated(block.timestamp, accRewardsPerShare);
        }
    }

    function _updatePool() internal override {
        if (address(getStrategy()) != address(0)) {
            // Get all reward tokens
            try getStrategy().getRewardTokens() returns (
                address[] memory tokens
            ) {
                // Notify vault about all tokens
                for (uint i = 0; i < tokens.length; i++) {
                    if (tokens[i] != address(0)) {
                        _notifyRewardToken(IERC20(tokens[i]));
                    }
                }
            } catch {
                // Strategy doesn't support getRewardTokens() or external call failed
                // Continue without notifying tokens
            }
            try getStrategy().harvestRewards() {} catch {
                // silently fail if no rewards are available
            }
        }
        updateAccRewardsPerShare();
    }

    /**
     * @dev will be called on base vault deposit and withdrawal
     * Update pool must be is called before.
     * @param user user
     * @param amount amount
     */
    function _modifyUser(
        address user,
        int256 amount
    ) internal virtual override {
        User storage userData = _users[user];
        uint256 uAmount = uint256(amount < 0 ? -amount : amount);
        uint256 phantomAmount = (uAmount * PHANTOM_SHARE_PRECISION) /
            (10 ** decimals());

        // First calculate all pending rewards and update state
        uint256[] memory payoutAmounts = new uint256[](
            cachedRewardTokens.length
        );
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            payoutAmounts[i] = _harvest(user, reward);
        }
        if (amount != 0) {
            // update phantom amount
            userData.phantomAmount = amount > 0
                ? userData.phantomAmount + phantomAmount
                : userData.phantomAmount - phantomAmount;

            // update phantom supply
            _phantomShareSupply = amount > 0
                ? _phantomShareSupply + phantomAmount
                : _phantomShareSupply - phantomAmount;
        }
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            userData.rewardDebtPerToken[address(reward.token)] = (userData
                .phantomAmount * reward.accRewardsPerShare).unshiftPrecision();
        }

        // Perform all token transfers
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            if (payoutAmounts[i] > 0) {
                TokenHelper.safeTransfer(
                    cachedRewardTokens[i].token,
                    user,
                    payoutAmounts[i]
                );
            }
        }
    }

    /**
     * @dev Harvest rewards for a user without trasfer
     */
    function _harvest(
        address user,
        Reward storage reward
    ) internal returns (uint256 payoutAmount) {
        payoutAmount = _calcPending(user, reward, reward.accRewardsPerShare);
        reward.lastRewardBalance = reward.lastRewardBalance - payoutAmount;

        emit Harvested(user, address(reward.token), payoutAmount);
    }

    /**
     * @dev Claim rewards of the sender.
     */
    function claim() external override nonReentrant {
        _updatePool();
        _modifyUser(msg.sender, 0);
    }

    /**
     * @dev claim rewards of sender before transfering it to recipient
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        if (!_isIgnored(recipient) || !_isIgnored(sender)) _updatePool();

        // we dont want to modify if the transfer is between user and strategy and vice versa
        // otherwise the accounting will be wrong as we modify the shares on reedem
        if (
            sender == address(getStrategy()) ||
            recipient == address(getStrategy())
        ) {
            super._transfer(sender, recipient, amount);
            return;
        }

        if (!_isIgnored(recipient)) _modifyUser(recipient, int256(amount));
        if (!_isIgnored(sender)) _modifyUser(sender, -int256(amount));

        super._transfer(sender, recipient, amount);
    }

    /**
     * Check if address is ingored for rewards (e.g strategy, or other addresses)
     * @param _address address
     */
    function _isIgnored(address _address) internal view returns (bool) {
        if (_address == address(getStrategy())) {
            return true;
        }
        return getFactory().isTransferIgnored(_address);
    }

    function _beforeEmergencyMode() internal virtual override {
        // nothing
    }

    function _rewardX() internal view override returns (uint256) {
        uint256 rewardX = 0;
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            if (reward.token == _pair().getTokenX()) {
                rewardX += reward.lastRewardBalance;
            }
        }
        return rewardX;
    }

    function _rewardY() internal view override returns (uint256) {
        uint256 rewardY = 0;
        for (uint256 i = 0; i < cachedRewardTokens.length; i++) {
            Reward storage reward = cachedRewardTokens[i];
            if (reward.token == _pair().getTokenY()) {
                rewardY += reward.lastRewardBalance;
            }
        }
        return rewardY;
    }
}

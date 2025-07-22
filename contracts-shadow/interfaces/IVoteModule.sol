// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.26;

interface IVoteModule {
    /** Custom Errors */

    /// @dev == 0
    error ZERO_AMOUNT();

    /// @dev if address is not xShadow
    error NOT_XSHADOW();

    /// @dev error for when the cooldown period has not been passed yet
    error COOLDOWN_ACTIVE();

    /// @dev error for when you try to deposit or withdraw for someone who isn't the msg.sender
    error NOT_VOTEMODULE();

    /// @dev error for when the caller is not authorized
    error UNAUTHORIZED();

    /// @dev error for accessHub gated functions
    error NOT_ACCESSHUB();

    /// @dev error for when there is no change of state
    error NO_CHANGE();

    /// @dev error for when address is invalid
    error INVALID_ADDRESS();

    /** Events */

    event Deposit(address indexed from, uint256 amount);

    event Withdraw(address indexed from, uint256 amount);

    event NotifyReward(address indexed from, uint256 amount);

    event ClaimRewards(address indexed from, uint256 amount);

    event ExemptedFromCooldown(address indexed candidate, bool status);

    event NewDuration(uint256 oldDuration, uint256 newDuration);

    event NewCooldown(uint256 oldCooldown, uint256 newCooldown);

    event Delegate(
        address indexed delegator,
        address indexed delegatee,
        bool indexed isAdded
    );

    event SetAdmin(
        address indexed owner,
        address indexed operator,
        bool indexed isAdded
    );

    /** Functions */
    function delegates(address) external view returns (address);
    /// @notice mapping for admins for a specific address
    /// @param owner the owner to check against
    /// @return operator the address that is designated as an admin/operator
    function admins(address owner) external view returns (address operator);

    function accessHub() external view returns(address);

    /// @notice returns the last time the reward was modified or periodFinish if the reward has ended
    function lastTimeRewardApplicable() external view returns (uint256 _ltra);

    function earned(address account) external view returns (uint256 _reward);
    /// @notice the time which users can deposit and withdraw
    function unlockTime() external view returns (uint256 _timestamp);

    /// @notice claims pending rebase rewards
    function getReward() external;

    function rewardPerToken() external view returns (uint256 _rewardPerToken);

    /// @notice deposits all xShadow in the caller's wallet
    function depositAll() external;

    /// @notice deposit a specified amount of xShadow
    function deposit(uint256 amount) external;

    /// @notice withdraw all xShadow
    function withdrawAll() external;

    /// @notice withdraw a specified amount of xShadow
    function withdraw(uint256 amount) external;

    /// @notice check for admin perms
    /// @param operator the address to check
    /// @param owner the owner to check against for permissions
    function isAdminFor(
        address operator,
        address owner
    ) external view returns (bool approved);

    /// @notice check for delegations
    /// @param delegate the address to check
    /// @param owner the owner to check against for permissions
    function isDelegateFor(
        address delegate,
        address owner
    ) external view returns (bool approved);

    /// @notice rewards pending to be distributed for the reward period
    /// @return _left rewards remaining in the period
    function left() external view returns (uint256 _left);

    /// @notice used by the xShadow contract to notify pending rebases
    /// @param amount the amount of Shadow to be notified from exit penalties
    function notifyRewardAmount(uint256 amount) external;

    /// @notice the address of the xShadow token (staking/voting token)
    /// @return _xShadow the address
    function xShadow() external view returns (address _xShadow);

    /// @notice address of the voter contract
    /// @return _voter the voter contract address
    function voter() external view returns (address _voter);

    /// @notice returns the total voting power (equal to total supply in the VoteModule)
    /// @return _totalSupply the total voting power
    function totalSupply() external view returns (uint256 _totalSupply);

    /// @notice last time the rewards system was updated
    function lastUpdateTime() external view returns (uint256 _lastUpdateTime);

    /// @notice rewards per xShadow
    /// @return _rewardPerToken the amount of rewards per xShadow
    function rewardPerTokenStored()
        external
        view
        returns (uint256 _rewardPerToken);

    /// @notice when the 1800 seconds after notifying are up
    function periodFinish() external view returns (uint256 _periodFinish);

    /// @notice calculates the rewards per second
    /// @return _rewardRate the rewards distributed per second
    function rewardRate() external view returns (uint256 _rewardRate);

    /// @notice voting power
    /// @param user the address to check
    /// @return amount the staked balance
    function balanceOf(address user) external view returns (uint256 amount);

    /// @notice rewards per amount of xShadow's staked
    function userRewardPerTokenStored(
        address user
    ) external view returns (uint256 rewardPerToken);

    /// @notice the amount of rewards claimable for the user
    /// @param user the address of the user to check
    /// @return rewards the stored rewards
    function storedRewardsPerUser(
        address user
    ) external view returns (uint256 rewards);

    /// @notice delegate voting perms to another address
    /// @param delegatee who you delegate to
    /// @dev set address(0) to revoke
    function delegate(address delegatee) external;

    /// @notice give admin permissions to a another address
    /// @param operator the address to give administrative perms to
    /// @dev set address(0) to revoke
    function setAdmin(address operator) external;

    function cooldownExempt(address) external view returns (bool);

    function setCooldownExemption(address, bool) external;

    function setNewDuration(uint) external;

    function setNewCooldown(uint) external;
}

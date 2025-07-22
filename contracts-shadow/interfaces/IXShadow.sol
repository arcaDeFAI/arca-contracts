// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVoter} from "./IVoter.sol";

interface IXShadow is IERC20 {
    struct VestPosition {
        /// @dev amount of xShadow
        uint256 amount;
        /// @dev start unix timestamp
        uint256 start;
        /// @dev start + MAX_VEST (end timestamp)
        uint256 maxEnd;
        /// @dev vest identifier (starting from 0)
        uint256 vestID;
    }

    error NOT_WHITELISTED(address);
    error NOT_MINTER();
    error ZERO();
    error NO_VEST();
    error ALREADY_EXEMPT();
    error NOT_EXEMPT();
    error CANT_RESCUE();
    error NO_CHANGE();
    error ARRAY_LENGTHS();
    error TOO_HIGH();
    error VEST_OVERLAP();

    event CancelVesting(
        address indexed user,
        uint256 indexed vestId,
        uint256 amount
    );
    event ExitVesting(
        address indexed user,
        uint256 indexed vestId,
        uint256 amount
    );
    event InstantExit(address indexed user, uint256);

    event NewSlashingPenalty(uint256 penalty);

    event NewVest(
        address indexed user,
        uint256 indexed vestId,
        uint256 indexed amount
    );
    event NewVestingTimes(uint256 min, uint256 max);

    event Converted(address indexed user, uint256);

    event Exemption(address indexed candidate, bool status, bool success);

    event XShadowRedeemed(address indexed user, uint256);

    event NewOperator(address indexed o, address indexed n);

    event Rebase(address indexed caller, uint256 amount);

    /// @notice returns info on a user's vests
    function vestInfo(
        address user,
        uint256
    )
        external
        view
        returns (uint256 amount, uint256 start, uint256 maxEnd, uint256 vestID);

    /// @notice address of the shadow token
    function SHADOW() external view returns (IERC20);

    /// @notice address of the voter
    function VOTER() external view returns (IVoter);

    function MINTER() external view returns (address);

    function ACCESS_HUB() external view returns (address);

    /// @notice address of the operator
    function operator() external view returns (address);

    /// @notice address of the VoteModule
    function VOTE_MODULE() external view returns (address);

    /// @notice max slashing amount
    function SLASHING_PENALTY() external view returns (uint256);

    /// @notice denominator
    function BASIS() external view returns (uint256);

    /// @notice the minimum vesting length
    function MIN_VEST() external view returns (uint256);

    /// @notice the maximum vesting length
    function MAX_VEST() external view returns (uint256);

    function shadow() external view returns (address);

    /// @notice the last period rebases were distributed
    function lastDistributedPeriod() external view returns (uint256);

    /// @notice amount of pvp rebase penalties accumulated pending to be distributed
    function pendingRebase() external view returns (uint256);

    /// @notice pauses the contract
    function pause() external;

    /// @notice unpauses the contract
    function unpause() external;

    /*****************************************************************/
    // General use functions
    /*****************************************************************/

    /// @dev mints xShadows for each shadow.
    function convertEmissionsToken(uint256 _amount) external;

    /// @notice function called by the minter to send the rebases once a week
    function rebase() external;
    /**
     * @dev exit instantly with a penalty
     * @param _amount amount of xShadows to exit
     */
    function exit(uint256 _amount) external returns(uint256 _exitedAmount);

    /// @dev vesting xShadows --> emissionToken functionality
    function createVest(uint256 _amount) external;

    /// @dev handles all situations regarding exiting vests
    function exitVest(uint256 _vestID) external;

    /*****************************************************************/
    // Permissioned functions, timelock/operator gated
    /*****************************************************************/

    /// @dev allows the operator to redeem collected xShadows
    function operatorRedeem(uint256 _amount) external;

    /// @dev allows rescue of any non-stake token
    function rescueTrappedTokens(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external;

    /// @notice migrates the operator to another contract
    function migrateOperator(address _operator) external;

    /// @notice set exemption status for an address
    function setExemption(
        address[] calldata _exemptee,
        bool[] calldata _exempt
    ) external;

    function setExemptionTo(
        address[] calldata _exemptee,
        bool[] calldata _exempt
    ) external;

    /*****************************************************************/
    // Getter functions
    /*****************************************************************/

    /// @notice returns the amount of SHADOW within the contract
    function getBalanceResiding() external view returns (uint256);
    /// @notice returns the total number of individual vests the user has
    function usersTotalVests(
        address _who
    ) external view returns (uint256 _numOfVests);

    /// @notice whether the address is exempt
    /// @param _who who to check
    /// @return _exempt whether it's exempt
    function isExempt(address _who) external view returns (bool _exempt);

    /// @notice returns the vest info for a user
    /// @param _who who to check
    /// @param _vestID vest ID to check
    /// @return VestPosition vest info
    function getVestInfo(
        address _who,
        uint256 _vestID
    ) external view returns (VestPosition memory);
}

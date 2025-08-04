// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {
    IERC20Upgradeable
} from "openzeppelin-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IVaultFactory} from "./IVaultFactory.sol";
import {IERC20} from "./IHooksRewarder.sol";

/**
 * @title Common Strategy Interface
 * @author Arca
 * @notice Common interface for all strategies (Metropolis, Shadow, etc.)
 */
interface IStrategyCommon {
    // Common errors
    error Strategy__OnlyFactory();
    error Strategy__OnlyVault();
    error Strategy__OnlyOperators();
    error Strategy__OnlyDefaultOperator();
    error Strategy__ZeroAmounts();
    error Strategy__InvalidAmount();
    error Strategy__InvalidToken();
    error Strategy__InvalidReceiver();
    error Strategy__InvalidFee();
    error Strategy__OnlyTrusted();
    error Strategy__RebalanceCoolDown();

    // Common events
    event OperatorSet(address operator);
    event RebalanceCoolDownSet(uint256 coolDown);
    event AumFeeCollected(
        address indexed sender,
        uint256 totalBalanceX,
        uint256 totalBalanceY,
        uint256 feeX,
        uint256 feeY
    );
    event AumAnnualFeeSet(uint256 fee);
    event PendingAumAnnualFeeSet(uint256 fee);
    event PendingAumAnnualFeeReset();

    // Core getters
    function getFactory() external view returns (IVaultFactory);
    function getVault() external pure returns (address);
    function getTokenX() external pure returns (IERC20Upgradeable);
    function getTokenY() external pure returns (IERC20Upgradeable);
    function getOperator() external view returns (address);

    // Strategy type for casting
    function getStrategyType()
        external
        view
        returns (IVaultFactory.StrategyType);

    // Fee management
    function getAumAnnualFee() external view returns (uint256 aumAnnualFee);
    function getPendingAumAnnualFee()
        external
        view
        returns (bool isSet, uint256 pendingAumAnnualFee);
    function setPendingAumAnnualFee(uint16 pendingAumAnnualFee) external;
    function resetPendingAumAnnualFee() external;

    // Balance calculations
    function getBalances()
        external
        view
        returns (uint256 amountX, uint256 amountY);
    function getIdleBalances()
        external
        view
        returns (uint256 amountX, uint256 amountY);

    // Rewards
    function getRewardTokens() external view returns (address[] memory);
    function hasRewards() external view returns (bool);
    function hasExtraRewards() external view returns (bool);
    function harvestRewards() external;

    // Operations
    function getLastRebalance() external view returns (uint256 lastRebalance);
    function setRebalanceCoolDown(uint256 coolDown) external;

    // Core functionality
    function initialize() external;
    function withdrawAll() external;
    function setOperator(address operator) external;

    // Note: rebalance() is NOT included here as it has protocol-specific parameters
}

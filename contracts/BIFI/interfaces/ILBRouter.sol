// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Liquidity Book Router Interface
 * @author Trader Joe
 * @notice Required interface for LBRouter integration based on TraderJoe V2
 */
interface ILBRouter {
    /**
     * @dev Struct containing the parameters for the addLiquidity function.
     * @param tokenX The address of token X
     * @param tokenY The address of token Y
     * @param binStep The bin step of the LBPair
     * @param amountX The amount of token X to add
     * @param amountY The amount of token Y to add
     * @param amountXMin The minimum amount of token X to add
     * @param amountYMin The minimum amount of token Y to add
     * @param activeIdDesired The desired active bin id
     * @param idSlippage The number of bins to slip
     * @param deltaIds The bin ids deltas
     * @param distributionX The distribution of tokenX
     * @param distributionY The distribution of tokenY
     * @param to The address to receive the liquidity tokens
     * @param refundTo The address to receive the refunded tokens
     * @param deadline The deadline of the transaction
     */
    struct LiquidityParameters {
        address tokenX;
        address tokenY;
        uint16 binStep;
        uint256 amountX;
        uint256 amountY;
        uint256 amountXMin;
        uint256 amountYMin;
        uint256 activeIdDesired;
        uint256 idSlippage;
        int256[] deltaIds;
        uint256[] distributionX;
        uint256[] distributionY;
        address to;
        address refundTo;
        uint256 deadline;
    }

    /**
     * @notice Add liquidity while performing safety checks
     * @dev This function is compliant with fee on transfer tokens
     * @param liquidityParameters The liquidity parameters
     * @return amountXAdded Amount of token X added
     * @return amountYAdded Amount of token Y added
     * @return amountXLeft Amount of token X left (not added)
     * @return amountYLeft Amount of token Y left (not added)
     * @return activeId Active id of the LBPair
     */
    function addLiquidity(LiquidityParameters calldata liquidityParameters)
        external
        returns (
            uint256 amountXAdded,
            uint256 amountYAdded,
            uint256 amountXLeft,
            uint256 amountYLeft,
            uint256 activeId
        );

    /**
     * @notice Remove liquidity while performing safety checks
     * @dev This function is compliant with fee on transfer tokens
     * @param tokenX The address of token X
     * @param tokenY The address of token Y
     * @param binStep The bin step of the LBPair
     * @param amountXMin The min amount to receive of token X
     * @param amountYMin The min amount to receive of token Y
     * @param ids The ids of the bins from which to remove liquidity
     * @param amounts The amounts of liquidity to remove
     * @param to The address of the recipient
     * @param deadline The deadline of the tx
     * @return amountX Amount of token X returned
     * @return amountY Amount of token Y returned
     */
    function removeLiquidity(
        address tokenX,
        address tokenY,
        uint16 binStep,
        uint256 amountXMin,
        uint256 amountYMin,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        address to,
        uint256 deadline
    ) external returns (uint256 amountX, uint256 amountY);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ILBRouter} from "../../lib/joe-v2/src/interfaces/ILBRouter.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

contract MockLBRouter {
    mapping(address => uint256) private tokenSwapOutputs; // tokenOut => amount
    bool private shouldFail;

    function setSwapOutputForToken(address token, uint256 amount) external {
        tokenSwapOutputs[token] = amount;
    }

    // Legacy function for backwards compatibility
    function setSwapOutput(uint256 _outputX, uint256 _outputY) external {
        // This will be set by tokenX and tokenY addresses in tests
    }

    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut) {
        require(!shouldFail, "MockLBRouter: Swap failed");
        require(block.timestamp <= deadline, "MockLBRouter: Expired");

        // Determine which token we're swapping to based on path
        IERC20 tokenOut = path.tokenPath[path.tokenPath.length - 1];
        address tokenOutAddress = address(tokenOut);

        // Get the configured output amount for this specific token
        uint256 outputAmount = tokenSwapOutputs[tokenOutAddress];

        if (outputAmount > 0) {
            tokenOut.transfer(to, outputAmount);
            return outputAmount;
        }

        return 0;
    }

    function swapExactTokensForNATIVE(
        uint256 amountIn,
        uint256 amountOutMin,
        ILBRouter.Path memory path,
        address payable to,
        uint256 deadline
    ) external returns (uint256 amountOut) {
        require(!shouldFail, "MockLBRouter: Swap failed");
        require(block.timestamp <= deadline, "MockLBRouter: Expired");

        // Mock native swap - just return some amount
        return amountIn / 2;
    }

    function addLiquidity(
        ILBRouter.LiquidityParameters memory liquidityParameters
    )
        external
        returns (
            uint256 amountXAdded,
            uint256 amountYAdded,
            uint256 amountXLeft,
            uint256 amountYLeft,
            uint256[] memory depositIds,
            uint256[] memory liquidityMinted
        )
    {
        // Mock: just return the amounts that were attempted to be added
        amountXAdded = liquidityParameters.amountX;
        amountYAdded = liquidityParameters.amountY;
        amountXLeft = 0;
        amountYLeft = 0;

        depositIds = new uint256[](1);
        depositIds[0] = 8388608; // Mock active ID

        liquidityMinted = new uint256[](1);
        liquidityMinted[0] = amountXAdded + amountYAdded;
    }

    function removeLiquidity(
        IERC20 tokenX,
        IERC20 tokenY,
        uint16 binStep,
        uint256 amountXMin,
        uint256 amountYMin,
        uint256[] memory ids,
        uint256[] memory amounts,
        address to,
        uint256 deadline
    ) external returns (uint256 amountX, uint256 amountY) {
        require(block.timestamp <= deadline, "MockLBRouter: Expired");

        // Mock: return some amounts
        amountX = 1000;
        amountY = 1000;

        // Mock transfer tokens to recipient
        tokenX.transfer(to, amountX);
        tokenY.transfer(to, amountY);
    }
}

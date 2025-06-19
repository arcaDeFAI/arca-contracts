// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ILBRouter} from "../../lib/joe-v2/src/interfaces/ILBRouter.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

contract MockLBRouter {
    uint256 private swapOutputX;
    uint256 private swapOutputY;
    bool private shouldFail;
    uint256 private swapCount; // Track number of swaps

    function setSwapOutput(uint256 _outputX, uint256 _outputY) external {
        swapOutputX = _outputX;
        swapOutputY = _outputY;
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
        
        // Mock: alternate between TokenX and TokenY outputs for different swaps
        uint256 outputAmount;
        if (swapCount % 2 == 0 && swapOutputX > 0) {
            outputAmount = swapOutputX;
        } else if (swapCount % 2 == 1 && swapOutputY > 0) {
            outputAmount = swapOutputY;
        } else {
            outputAmount = swapOutputX > 0 ? swapOutputX : swapOutputY;
        }
        
        swapCount++;
        
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
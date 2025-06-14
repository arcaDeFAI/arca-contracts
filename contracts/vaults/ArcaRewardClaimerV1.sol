// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ILBRouter } from "../../lib/joe-v2/src/interfaces/ILBRouter.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { ILBPair } from "../../lib/joe-v2/src/interfaces/ILBPair.sol";
import { ILBHooksBaseRewarder } from "../interfaces/Metropolis/ILBHooksBaseRewarder.sol";
import { IArcaFeeManagerV1 } from "../interfaces/IArcaFeeManagerV1.sol";
import { TokenValidator } from "../TokenTypes.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IArcaRewardClaimerV1 } from "../interfaces/IArcaRewardClaimerV1.sol";

contract ArcaRewardClaimerV1 is Ownable, ReentrancyGuardUpgradeable, TokenValidator, IArcaRewardClaimerV1 {
    using SafeERC20 for IERC20;
    address private _rewarder;
    address private _rewardToken;
    IArcaFeeManagerV1 private _feeManager;
    uint256 public minSwapAmount;       // Minimum amounts for swapping (to avoid dust)
    IERC20[TOKEN_COUNT] private tokens; // Main Tokens (token X and token Y) that the vault will hold

    // Native token address (WAVAX or similar)
    address public nativeToken;
    
    // Swap paths for METRO -> tokenX and METRO -> tokenY
    ILBRouter.Path[TOKEN_COUNT] private metroToTokenPaths;
    ILBRouter.Path private metroToNativePath;

    // Compounding tracking
    uint256[TOKEN_COUNT] private totalCompounded; // Total compounded from rewards per token

    address private _lbpContract;
    address private _lbRouter;
    uint256 public idSlippage; // The number of bins to slip

    constructor(
        address rewarder,
        address rewardToken,
        IArcaFeeManagerV1 feeManager,
        address _nativeToken,
        address lbpContract,
        address lbRouter,
        uint256 _idSlippage,
        address tokenX,
        address tokenY) Ownable(msg.sender) {
        _rewarder = rewarder;
        _rewardToken = rewardToken;
        _feeManager = feeManager;
        nativeToken = _nativeToken;
        _lbpContract = lbpContract;
        _lbRouter = lbRouter;
        idSlippage = _idSlippage;
        minSwapAmount = 10; // 0.001 METRO minimum
        tokens[uint256(TokenValidator.Type.TokenX)] = IERC20(tokenX);
        tokens[uint256(TokenValidator.Type.TokenY)] = IERC20(tokenY);
    }

    // Events
    event FeeCollected(address indexed recipient, uint256 amount, string feeType);
    event RewardsClaimed(
        address rewarder,
        address token,
        uint256 amount
    );
    
    event RewardsCompounded(
        uint256 metroAmount,
        uint256 tokenXCompounded,
        uint256 tokenYCompounded
    );

    function getTotalCompounded(TokenValidator.Type tokenType) private validToken(tokenType) view returns(uint256) {
        return totalCompounded[uint256(tokenType)];
    }

    function setMinSwapAmount(uint256 _minSwapAmount) external onlyOwner {
        minSwapAmount = _minSwapAmount;
    }

    function getVaultToken(TokenValidator.Type tokenType) private validToken(tokenType) view returns(IERC20) {
        return tokens[uint256(tokenType)];
    }

    /**
     * @dev Set swap paths for METRO rewards
     */
    function setSwapPaths(
        ILBRouter.Path calldata _metroToTokenXPath,
        ILBRouter.Path calldata _metroToTokenYPath,
        ILBRouter.Path calldata _metroToNativePath
    ) external onlyOwner {
        metroToTokenPaths = [_metroToTokenXPath, _metroToTokenYPath];
        metroToNativePath = _metroToNativePath;
    }

    /**
     * @dev Updates the rewarder address
     */
    function setRewarder(address rewarder) external onlyOwner {
        require(_rewarder != address(0), "Invalid rewarder address");
        _rewarder = rewarder;
    }

    /**
     * @dev Claims METRO rewards and compounds them into tokenX and tokenY
     * This increases the value of existing shares without minting new ones
     */
    function claimAndCompoundRewards() external onlyOwner {
        if (_rewarder == address(0)) return;
        
        // Get bin IDs where we have positions
        uint256[] memory binIds = getVaultBinIds();
        if (binIds.length == 0) return;
        
        uint256 metroBalanceBefore = IERC20(_rewardToken).balanceOf(address(this));
        
        // Claim METRO rewards
        try ILBHooksBaseRewarder(_rewarder).claim(address(this), binIds) {
            uint256 metroBalanceAfter = IERC20(_rewardToken).balanceOf(address(this));
            uint256 metroClaimed = metroBalanceAfter - metroBalanceBefore;
            
            if (metroClaimed > minSwapAmount) {
                // Calculate performance fee on claimed rewards
                uint256 performanceFee = (metroClaimed * _feeManager.getPerformanceFee()) / _feeManager.BASIS_POINTS();
                uint256 netMetro = metroClaimed - performanceFee;
                
                // Send performance fee to fee recipient
                if (performanceFee > 0) {
                    IERC20(_rewardToken).safeTransfer(_feeManager.getFeeRecipient(), performanceFee);
                    emit FeeCollected(_feeManager.getFeeRecipient(), performanceFee, "performance");
                }
                
                // Compound the remaining rewards
                uint256 metroForTokenX = netMetro / 2;
                uint256 metroForTokenY = netMetro - metroForTokenX;
                
                uint256[TOKEN_COUNT] memory metroForTokens = [metroForTokenX, metroForTokenY];
                uint256[TOKEN_COUNT] memory tokenObtained;

                for (uint256 i = 0; i < TOKEN_COUNT; i++) {
                    tokenObtained[i] = 0;
                    
                    // Swap METRO to token
                    if (metroForTokens[i] > 0) {
                        tokenObtained[i] = _swapMetroToToken(metroForTokens[i], address(getVaultToken(TokenValidator.Type(i))), metroToTokenPaths[i]);
                    }

                    // Update compounding totals - these tokens increase share value
                    totalCompounded[i] += tokenObtained[i];
                }
                
                emit RewardsClaimed(_rewarder, _rewardToken, metroClaimed);
                emit RewardsCompounded(metroClaimed, tokenObtained[uint256(TokenValidator.Type.TokenX)], tokenObtained[uint256(TokenValidator.Type.TokenY)]);
            }
        } catch {
            // Claiming failed, continue with rebalance
        }
    }

    /**
     * @dev Returns the bin IDs where the vault has LP positions
     */
    function getVaultBinIds() public view returns (uint256[] memory) {
        address lbPair = _lbpContract;
        uint256 activeId = ILBPair(lbPair).getActiveId();
        
        uint256[] memory binIds = new uint256[](2 * idSlippage + 1);
        
        for (uint256 i = 0; i < 2 * idSlippage + 1; i++) {
            binIds[i] = activeId - idSlippage + i;
        }
        
        return binIds;
    }

    /**
     * @dev Calculates the minimal expected amount of swap tokens for slippage protection.
     * @param metroAmount Amount of METRO tokens to swap
     * @param targetToken Address of the token to receive (tokenX for S, tokenY for USDC)
     * @return expectedOutput Minimal expected amount of target tokens after slippage
     */
    function getExpectedSwapOutput(
        uint256 metroAmount,
        address targetToken
    ) public view returns(uint256 expectedOutput, uint256 minimumExpectedOutput) {
        ILBPair routerPair = ILBPair(_lbpContract);
        //ILBAMM memory routerMetro = ILBAMM(vaultConfig.lbpAMM);
        
        uint256 decimals;
        uint256 metroDecimals = 18; // Assuming METRO has 18 decimals
        
        bool isTokenXY = targetToken == address(getVaultToken(TokenValidator.Type.TokenX)) ||
            targetToken == address(getVaultToken(TokenValidator.Type.TokenY));

        // Set decimals based on target token
        if (isTokenXY) {
            decimals = 18; // S token decimals
        } else {
            decimals = 6;  // USDC decimals
        }
        
        // Get current active bin ID and price
        uint24 activeID = routerPair.getActiveId(); 
        uint256 rawPrice = routerPair.getPriceFromId(activeID);
        
        // Convert 128.128 fixed-point price to human readable
        uint256 scale = 2**128;
        uint256 pricePerUnit; // Price of 1 METRO in terms of target token
        
        if(isTokenXY) {
            // Calculate METRO price in S tokens
            // rawPrice represents price of tokenY/tokenX, we need METRO/S
            // Since METRO is being swapped for S, we need the appropriate conversion
            pricePerUnit = (rawPrice * (10**decimals)) / (scale * (10**(metroDecimals - decimals)));
        } else {
            // Calculate METRO price in USDC
            // For USDC, we can use the inverse since 1 USDC = 1 USD
            pricePerUnit = (scale * (10**decimals)) / (rawPrice * (10**(metroDecimals - decimals)));
        }
        
        // Calculate expected output before slippage
        expectedOutput = (metroAmount * pricePerUnit) / (10**metroDecimals);
        
        // Apply slippage protection (e.g., 0.5% slippage tolerance)
        uint256 slippageBasisPoints = 50; // 0.5% = 50 basis points
        uint256 slippageFactor = 10000 - slippageBasisPoints; // 9950
        
        // Calculate minimal expected output with slippage protection
        minimumExpectedOutput = (expectedOutput * slippageFactor) / 10000;
        
        return (expectedOutput, minimumExpectedOutput);
    }

    /**
     * @dev Swaps METRO to target token using the appropriate path
     */
    function _swapMetroToToken(
        uint256 metroAmount, 
        address targetToken, 
        ILBRouter.Path memory swapPath
    ) private returns (uint256 amountOut) {
        if (metroAmount == 0 || swapPath.tokenPath.length == 0) return 0;
        
        IERC20(_rewardToken).approve(_lbRouter, 0);
        IERC20(_rewardToken).approve(_lbRouter, metroAmount);
        
        uint256 balanceBefore = IERC20(targetToken).balanceOf(address(this));

        // Get expected output from price oracle
        ( , uint256 minAmountOut) = getExpectedSwapOutput(metroAmount, targetToken);

        try ILBRouter(_lbRouter).swapExactTokensForTokens(
            metroAmount,
            minAmountOut, // Proper slippage protection
            swapPath,
            address(this),
            block.timestamp + 300
        ) returns (uint256) {
            uint256 balanceAfter = IERC20(targetToken).balanceOf(address(this));
            amountOut = balanceAfter - balanceBefore;
        } catch {
            // Swap failed, try native swap if target is not native
            if (targetToken != nativeToken && metroToNativePath.tokenPath.length > 0) {
                try ILBRouter(_lbRouter).swapExactTokensForNATIVE(
                    metroAmount,
                    0,
                    metroToNativePath,
                    payable(address(this)),
                    block.timestamp + 300
                ) {
                    // Additional logic for native token handling could go here
                } catch {
                    // Both swaps failed, keep METRO
                }
            }
        }
        
        return amountOut;
    }

    /**
     * @dev Manual function to claim rewards without rebalancing
     */
    function claimRewards(
        uint256[] calldata binIds,
        address receiver
    ) external onlyOwner nonReentrant returns (uint256 claimedAmount) {
        require(_rewarder != address(0), "Rewarder not set");
        require(binIds.length > 0, "No bin IDs provided");
        require(receiver != address(0), "Invalid receiver address");
        
        // Get balance before claiming
        uint256 balanceBefore = IERC20(_rewardToken).balanceOf(address(this));
        
        // Call the correct claim function
        ILBHooksBaseRewarder(_rewarder).claim(receiver, binIds);
        
        // Calculate how much was actually claimed
        uint256 balanceAfter = IERC20(_rewardToken).balanceOf(address(this));
        claimedAmount = balanceAfter - balanceBefore;
        
        emit RewardsClaimed(_rewarder, _rewardToken, claimedAmount);
        
        return claimedAmount;
    }
}
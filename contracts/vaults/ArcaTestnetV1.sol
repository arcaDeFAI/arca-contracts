// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.28;

import { ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { ILBRouter } from "../../lib/joe-v2/src/interfaces/ILBRouter.sol";
import { ILBHooksBaseRewarder } from "../interfaces/Metropolis/ILBHooksBaseRewarder.sol";
import { ILBPair } from "../../lib/joe-v2/src/interfaces/ILBPair.sol";
import { ArcaFeeManager } from "../ArcaFeeManager.sol";
import { ArcaQueueHandlerV1, IDepositWithdrawCompatible } from "./ArcaQueueHandlerV1.sol";
import { TokenValidator } from "../TokenTypes.sol";

/**
 * @dev Implementation of a vault with queued deposits and withdrawals
 * Separate share tracking for tokenX and tokenY
 * This contract receives funds and users interface with it.
 * Rebalancing functionality processes queues and manages liquidity.
 * Enhanced with METRO reward claiming and automatic compounding functionality.
 */
contract ArcaTestnetV1 is 
    ERC20Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, IDepositWithdrawCompatible, TokenValidator {
    using SafeERC20 for IERC20;

    uint256 private constant TOKEN_COUNT = 2;

    function getVaultToken(TokenValidator.Type tokenType) private validToken(tokenType) view returns(IERC20) {
        return vaultConfig.tokens[uint256(tokenType)];
    }

    function getTokenMinAmount(TokenValidator.Type tokenType) private validToken(tokenType) view returns(uint256) {
        return vaultConfig.amountMins[uint256(tokenType)];
    }

    function getMetroToTokenPath(TokenValidator.Type tokenType) private validToken(tokenType) view returns(ILBRouter.Path memory) {
        return metroToTokenPaths[uint256(tokenType)];
    }

    function getTokenTotalShares(TokenValidator.Type tokenType) private validToken(tokenType) view returns(uint256) {
        return totalShares[uint256(tokenType)];
    }

    function getTotalCompounded(TokenValidator.Type tokenType) private validToken(tokenType) view returns(uint256) {
        return totalCompounded[uint256(tokenType)];
    }

    struct VaultConfig {
        IERC20[TOKEN_COUNT] tokens;         // Main Tokens (token X and token Y) that the vault will hold
        uint16 binStep;                     // The bin step for liquidity positions
        uint256[TOKEN_COUNT] amountMins;    // Minimum amount of token X to add during rebalance
        uint256 idSlippage;                 // The number of bins to slip
        address lbRouter;                   // Address of the LB Router
        address lbpAMM;                     // Address of the Metro-S AMM LP pair
        address lbpContract;                // Address of the LBP contract
        address rewarder;                   // Address of the LBHooksBaseRewarder contract
        address rewardToken;                // Address of the reward token (METRO)
    }

    VaultConfig private vaultConfig;
    ArcaFeeManager private feeManager;
    ArcaQueueHandlerV1 private queueHandler;

    // Native token address (WAVAX or similar)
    address public nativeToken;
    
    // Swap paths for METRO -> tokenX and METRO -> tokenY
    ILBRouter.Path[TOKEN_COUNT] private metroToTokenPaths;
    ILBRouter.Path private metroToNativePath;
    
    // Minimum amounts for swapping (to avoid dust)
    uint256 public minSwapAmount;

    // Store bin IDs from last add liquidity operation
    uint256[] public lastAddLiquidityBinIds;
    
    // Share tracking
    uint256[TOKEN_COUNT] private totalShares;
    mapping(address => uint256[TOKEN_COUNT]) public shares;
    
    // Compounding tracking
    uint256[TOKEN_COUNT] public totalCompounded; // Total compounded from rewards per token
    
    // Events
    event SharesMinted(address indexed user, uint256 sharesX, uint256 sharesY);
    event WithdrawProcessed(address indexed user, uint256 amountX, uint256 amountY);
    event FeeCollected(address indexed recipient, uint256 amount, string feeType);
    
    event Rebalanced(
        address tokenX, 
        address tokenY, 
        uint256 amountXAdded, 
        uint256 amountYAdded, 
        uint256 amountXRemoved, 
        uint256 amountYRemoved,
        uint256 depositsProcessed,
        uint256 withdrawsProcessed
    );
    
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

    /**
     * @dev Initializes the vault's own token.
     * These tokens are minted when someone does a deposit. It is burned in order
     * to withdraw the corresponding portion of the underlying assets.
     */
    function initialize(
        address _tokenX,
        address _tokenY,
        uint16 _binStep,
        uint256 _amountXMin,
        uint256 _amountYMin,
        uint256 _idSlippage,
        string memory _name,
        string memory _symbol,
        address _lbRouter,
        address _lbpAMM,
        address _lbpContract,
        address _rewarder,
        address _rewardToken,
        address _nativeToken
    ) public initializer {
        __ERC20_init(_name, _symbol);
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        
        IERC20[TOKEN_COUNT] memory tokens;
        tokens[uint256(TokenValidator.Type.TokenX)] = IERC20(_tokenX);
        tokens[uint256(TokenValidator.Type.TokenY)] = IERC20(_tokenY);
        uint256[TOKEN_COUNT] memory amountMins;
        amountMins[uint256(TokenValidator.Type.TokenX)] = _amountXMin;
        amountMins[uint256(TokenValidator.Type.TokenY)] = _amountYMin;
        vaultConfig = VaultConfig(tokens, _binStep, amountMins, _idSlippage, _lbRouter, _lbpAMM, _lbpContract, _rewarder, _rewardToken);
        nativeToken = _nativeToken;
        
        feeManager = ArcaFeeManager(msg.sender);
        queueHandler = ArcaQueueHandlerV1(msg.sender);
        
        minSwapAmount = 10; // 0.001 METRO minimum
    }

    /**
     * @dev It calculates the total underlying value of tokenX or tokenY held by the system.
     * It takes into account the vault contract balance excluding queued tokens.
     */
    function tokenBalance(TokenValidator.Type tokenType) public view validToken(tokenType) returns (uint256) {
        return getVaultToken(tokenType).balanceOf(address(this)) - queueHandler.getQueuedToken(tokenType);
    }
    
    function totalSupply(TokenValidator.Type tokenType) public view validToken(tokenType) returns (uint256) {
        return totalShares[uint256(tokenType)];
    }

    /**
     * @dev Function for various UIs to display the current value of one of our yield tokens.
     * Returns an uint256 with 18 decimals of how much underlying asset one vault share represents.
     * This is a simplified implementation that considers only a token type for share value calculation.
     */
    function getPricePerFullShare(TokenValidator.Type tokenType) public view validToken(tokenType) returns (uint256) {
        return totalSupply(tokenType) == 0 ? 1e18 : tokenBalance(tokenType) * 1e18 / totalSupply(tokenType);
    }

    /**
     * @dev A helper function to call depositToken() with all the sender's funds.
     */
    function depositAll(TokenValidator.Type tokenType) external validToken(tokenType) {
        uint256 balance = getVaultToken(tokenType).balanceOf(msg.sender);
        depositToken(balance, tokenType);
    }

    /**
     * @dev Modified deposit function for a token type - now adds to queue instead of immediate minting
     * Tokens are held in contract until next rebalance. Necessary for the rebalance and will help to calculate Shares.
     */
    function depositToken(uint256 _amount, TokenValidator.Type _tokenType) public validToken(_tokenType) nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        
        IERC20 token = getVaultToken(_tokenType);
        uint256 _pool = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = token.balanceOf(address(this));
        _amount = _after - _pool;
        
        // Calculate and collect deposit fee
        uint256 depositFee = (_amount * feeManager.getDepositFee()) / feeManager.BASIS_POINTS();
        uint256 netAmount = _amount - depositFee;
        
        if (depositFee > 0) {
            token.safeTransfer(feeManager.getFeeRecipient(), depositFee);
            emit FeeCollected(feeManager.getFeeRecipient(), depositFee, "deposit");
        }
        
        queueHandler.enqueueDepositRequest(DepositRequest({
            user: msg.sender,
            amount: netAmount,
            tokenType: _tokenType,
            timestamp: block.timestamp
        }));
    }

    /**
     * @dev Helper function to withdraw all shares
     */
    function withdrawAll() external {

        uint256[TOKEN_COUNT] memory sharesToWithdraw;

        for (uint256 i = 0; i < TOKEN_COUNT; i++) {
            sharesToWithdraw[i] = shares[msg.sender][i];
        }

        withdrawTokenShares(sharesToWithdraw);
    }

    /**
     * @dev Modified withdraw function - now adds to queue instead of immediate withdrawal
     * User specifies how many sharesX and sharesY they want to withdraw
     */
    function withdrawTokenShares(uint256[2] memory _shares) public nonReentrant {
        require (_shares.length == TOKEN_COUNT, "Invalid token share count");
        
        uint256 total = 0;

        for (uint256 i = 0; i < TOKEN_COUNT; i++) {
            total += _shares[i];
            require(shares[msg.sender][i] >= _shares[i], "Insufficient shares");
        }

        require(total > 0, "Cannot withdraw 0 shares");
        
        // Add to withdraw queue
        queueHandler.enqueueWithdrawRequest(WithdrawRequest({
            user: msg.sender,
            shares: _shares,
            timestamp: block.timestamp
        }));
    }

    /**
     * @dev Backward compatibility function - converts to separate share withdrawal
     */
    function withdraw(uint256 _shares) public nonReentrant {
        require(_shares > 0, "Cannot withdraw 0 shares");

        uint256 totalUserShares = 0;

        for (uint256 i = 0; i < TOKEN_COUNT; i++) {
            totalUserShares += shares[msg.sender][i];
        }

        require(totalUserShares >= _shares, "Insufficient shares");
        
        // Proportionally withdraw from both types
        uint256[TOKEN_COUNT] memory sharesToWithdraw;
        
        for (uint256 i = 0; i < TOKEN_COUNT; i++) {
            sharesToWithdraw[i] = (_shares * shares[msg.sender][i]) / totalUserShares; 
        }
        
        withdrawTokenShares(sharesToWithdraw);
    }

    struct RebalanceParams {
        int256[] deltaIds;
        uint256[] distributionX;
        uint256[] distributionY;
        uint256[] ids;
        uint256[] amounts;
        uint256 removeAmountXMin;
        uint256 removeAmountYMin;
        address to;
        address refundTo;
        uint256 deadline;
        bool forceRebalance;
    }

    function rebalance(
        RebalanceParams calldata params
    ) external onlyOwner nonReentrant returns (
        uint256 amountXAdded,
        uint256 amountYAdded,
        uint256 amountXRemoved,
        uint256 amountYRemoved
    ) {
        require(block.timestamp <= params.deadline, "Transaction expired");
        
        // Remove liquidity if needed
        if ((params.forceRebalance || params.ids.length > 0) && params.amounts.length > 0) {
            require(params.ids.length == params.amounts.length, "Array lengths must match");
            
            (amountXRemoved, amountYRemoved) = ILBRouter(vaultConfig.lbRouter).removeLiquidity(
                getVaultToken(TokenValidator.Type.TokenX),
                getVaultToken(TokenValidator.Type.TokenY), 
                vaultConfig.binStep,
                params.removeAmountXMin,
                params.removeAmountYMin,
                params.ids,
                params.amounts,
                address(this),
                params.deadline
            );
        }
        
        // Step 2: Claim and compound METRO rewards BEFORE processing queues
        _claimAndCompoundRewards();
        
        // Step 3: Process withdraw queue FIRST (before calculating deposit shares)
        uint256[TOKEN_COUNT] memory totalRemoved = [amountXRemoved, amountYRemoved];
        uint256 withdrawsProcessed = _processWithdrawQueue(totalRemoved);
        
        // Step 4: Process deposit queue (mint shares based on current state including compounded rewards)
        uint256 depositsProcessed = _processDepositQueue();
        
        // Add liquidity with remaining tokens
        uint256 availableTokenX = tokenBalance(TokenValidator.Type.TokenX);
        uint256 availableTokenY = tokenBalance(TokenValidator.Type.TokenY);
        IERC20 _tokenX = getVaultToken(TokenValidator.Type.TokenX);
        IERC20 _tokenY = getVaultToken(TokenValidator.Type.TokenY);
        
        if (availableTokenX > 0 || availableTokenY > 0) {
            // Approve and add liquidity
            if (availableTokenX > 0) {
                _tokenX.approve(vaultConfig.lbRouter, 0);
                _tokenX.approve(vaultConfig.lbRouter, availableTokenX);
            }
            
            if (availableTokenY > 0) {
                _tokenY.approve(vaultConfig.lbRouter, 0);
                _tokenY.approve(vaultConfig.lbRouter, availableTokenY);
            }
            
            ILBRouter.LiquidityParameters memory liquidityParams = ILBRouter.LiquidityParameters({
                tokenX: _tokenX,
                tokenY: _tokenY,
                binStep: vaultConfig.binStep,
                amountX: availableTokenX,
                amountY: availableTokenY,
                amountXMin: vaultConfig.amountMins[uint256(TokenValidator.Type.TokenX)],
                amountYMin: vaultConfig.amountMins[uint256(TokenValidator.Type.TokenY)],
                activeIdDesired: ILBPair(vaultConfig.lbpContract).getActiveId(),
                idSlippage: vaultConfig.idSlippage,
                deltaIds: params.deltaIds,
                distributionX: params.distributionX,
                distributionY: params.distributionY,
                to: params.to,
                refundTo: params.refundTo,
                deadline: params.deadline
            });
            
            (amountXAdded, amountYAdded, , , , ) = ILBRouter(vaultConfig.lbRouter).addLiquidity(liquidityParams);
        }
        
        emit Rebalanced(address(_tokenX), address(_tokenY), amountXAdded, amountYAdded, amountXRemoved, amountYRemoved, depositsProcessed, withdrawsProcessed);
        
        return (amountXAdded, amountYAdded, amountXRemoved, amountYRemoved);
    }

    /**
     * @dev Internal function to process withdraw queue
     * Calculates each user's share of withdrawn tokens and processes their withdrawal
     */
    function _processWithdrawQueue(uint256[2] memory totalRemoved) private returns (uint256 processed) {
        require(totalRemoved.length == TOKEN_COUNT, "Invalid array length");
        WithdrawRequest[] memory withdrawRequests = queueHandler.getWithdrawQueueTrailingSlice();
        
        for (uint256 i = 0; i < withdrawRequests.length; i++) {
            WithdrawRequest memory request = withdrawRequests[i];
            
            // Calculate user's share of withdrawn tokens
            uint256[TOKEN_COUNT] memory userAmounts;

            uint256 totalWithdrawAmount = 0;

            for (uint256 tokenIdx = 0; tokenIdx < TOKEN_COUNT; tokenIdx++) {
                // Share of removed liquidity
                userAmounts[tokenIdx] = totalRemoved[tokenIdx] * request.shares[tokenIdx] / totalShares[tokenIdx];

                uint256 existing = tokenBalance(TokenValidator.Type(tokenIdx));

                if (existing > 0) {
                    userAmounts[tokenIdx] += (existing * request.shares[tokenIdx]) / totalShares[tokenIdx];
                }

                totalWithdrawAmount += userAmounts[tokenIdx];
            }
            
            // Calculate withdraw fee on total withdrawal amount
            uint256 withdrawFee = (totalWithdrawAmount * feeManager.getWithdrawFee()) / feeManager.BASIS_POINTS();
            
            // Apply fee proportionally to both tokens
            if (withdrawFee > 0 && totalWithdrawAmount > 0) {

                for (uint256 tokenIdx = 0; tokenIdx < TOKEN_COUNT; tokenIdx++) {
                    uint256 fee = (userAmounts[tokenIdx] * withdrawFee) / totalWithdrawAmount;
                    userAmounts[tokenIdx] -= fee;

                    // Send fees to fee recipient
                    if (fee > 0) {
                        IERC20 token = getVaultToken(TokenValidator.Type(tokenIdx));
                        token.safeTransfer(feeManager.getFeeRecipient(), fee);
                    }
                }
                
                emit FeeCollected(feeManager.getFeeRecipient(), withdrawFee, "withdraw");
            }
            
            for (uint256 tokenIdx = 0; tokenIdx < TOKEN_COUNT; tokenIdx++) {
                // Burn user's shares
                shares[request.user][tokenIdx] -= request.shares[tokenIdx];
                totalShares[tokenIdx] -= request.shares[tokenIdx];
                
                // Transfer tokens to user
                if (userAmounts[tokenIdx] > 0) {
                    IERC20 token = getVaultToken(TokenValidator.Type(tokenIdx));
                    token.safeTransfer(request.user, userAmounts[tokenIdx]);
                }
            }
            
            
            emit WithdrawProcessed(request.user, userAmounts[uint256(TokenValidator.Type.TokenX)], userAmounts[uint256(TokenValidator.Type.TokenY)]);
            processed++;
        }
        
        return processed;
    }

    /**
     * @dev Internal function to process deposit queue
     * Mints shares based on current token balances after withdrawals are processed and rewards compounded
     */
    function _processDepositQueue() private returns (uint256 processed) {
        DepositRequest[] memory depositRequests = queueHandler.getDepositQueueTrailingSlice();
            
        for (uint256 i = 0; i < depositRequests.length; i++) {
            DepositRequest memory request = depositRequests[i];
            
            uint256 newShares = 0;

            uint256 tokenIdx = uint256(request.tokenType);

            // Calculate token shares to mint (benefits from compounded rewards increasing balance)
            if (totalShares[tokenIdx] == 0) {
                newShares = request.amount;
            } else {
                uint256 currentBalance = tokenBalance(request.tokenType);
                if (currentBalance > 0) {
                    newShares = (request.amount * totalShares[tokenIdx]) / currentBalance;
                } else {
                    newShares = request.amount; // Fallback if no balance
                }
            }

            // Update user shares and totals AFTER calculation
            shares[request.user][tokenIdx] += newShares;
            totalShares[tokenIdx] += newShares;
            
            // Remove from queued tokens (this adds to available balance for next person)
            queueHandler.reduceQueuedToken(request.amount, request.tokenType);
            bool isTokenX = request.tokenType == TokenValidator.Type.TokenX;
            emit SharesMinted(request.user, isTokenX ? newShares : 0, isTokenX ? 0 : newShares);
            processed++;
        }
        
        return processed;
    }

    /**
     * @dev Claims METRO rewards and compounds them into tokenX and tokenY
     * This increases the value of existing shares without minting new ones
     */
    function _claimAndCompoundRewards() internal {
        if (vaultConfig.rewarder == address(0)) return;
        
        // Get bin IDs where we have positions
        uint256[] memory binIds = getVaultBinIds();
        if (binIds.length == 0) return;
        
        uint256 metroBalanceBefore = IERC20(vaultConfig.rewardToken).balanceOf(address(this));
        
        // Claim METRO rewards
        try ILBHooksBaseRewarder(vaultConfig.rewarder).claim(address(this), binIds) {
            uint256 metroBalanceAfter = IERC20(vaultConfig.rewardToken).balanceOf(address(this));
            uint256 metroClaimed = metroBalanceAfter - metroBalanceBefore;
            
            if (metroClaimed > minSwapAmount) {
                // Calculate performance fee on claimed rewards
                uint256 performanceFee = (metroClaimed * feeManager.getPerformanceFee()) / feeManager.BASIS_POINTS();
                uint256 netMetro = metroClaimed - performanceFee;
                
                // Send performance fee to fee recipient
                if (performanceFee > 0) {
                    IERC20(vaultConfig.rewardToken).safeTransfer(feeManager.getFeeRecipient(), performanceFee);
                    emit FeeCollected(feeManager.getFeeRecipient(), performanceFee, "performance");
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
                
                emit RewardsClaimed(vaultConfig.rewarder, vaultConfig.rewardToken, metroClaimed);
                emit RewardsCompounded(metroClaimed, tokenObtained[uint256(TokenValidator.Type.TokenX)], tokenObtained[uint256(TokenValidator.Type.TokenY)]);
            }
        } catch {
            // Claiming failed, continue with rebalance
        }
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
        
        ILBPair routerPair = ILBPair(vaultConfig.lbpContract);
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
    ) internal returns (uint256 amountOut) {
        if (metroAmount == 0 || swapPath.tokenPath.length == 0) return 0;
        
        IERC20(vaultConfig.rewardToken).approve(vaultConfig.lbRouter, 0);
        IERC20(vaultConfig.rewardToken).approve(vaultConfig.lbRouter, metroAmount);
        
        uint256 balanceBefore = IERC20(targetToken).balanceOf(address(this));

        // Get expected output from price oracle
        ( , uint256 minAmountOut) = getExpectedSwapOutput(metroAmount, targetToken);

        try ILBRouter(vaultConfig.lbRouter).swapExactTokensForTokens(
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
                try ILBRouter(vaultConfig.lbRouter).swapExactTokensForNATIVE(
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
        require(vaultConfig.rewarder != address(0), "Rewarder not set");
        require(binIds.length > 0, "No bin IDs provided");
        require(receiver != address(0), "Invalid receiver address");
        
        // Get balance before claiming
        uint256 balanceBefore = IERC20(vaultConfig.rewardToken).balanceOf(address(this));
        
        // Call the correct claim function
        ILBHooksBaseRewarder(vaultConfig.rewarder).claim(receiver, binIds);
        
        // Calculate how much was actually claimed
        uint256 balanceAfter = IERC20(vaultConfig.rewardToken).balanceOf(address(this));
        claimedAmount = balanceAfter - balanceBefore;
        
        emit RewardsClaimed(vaultConfig.rewarder, vaultConfig.rewardToken, claimedAmount);
        
        return claimedAmount;
    }

    /**
     * @dev Returns the bin IDs where the vault has LP positions
     */
    function getVaultBinIds() public view returns (uint256[] memory) {
        address lbPair = vaultConfig.lbpContract;
        uint256 activeId = ILBPair(lbPair).getActiveId();
        
        uint256[] memory binIds = new uint256[](2 * vaultConfig.idSlippage + 1);
        
        for (uint256 i = 0; i < 2 * vaultConfig.idSlippage + 1; i++) {
            binIds[i] = activeId - vaultConfig.idSlippage + i;
        }
        
        return binIds;
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
     * @dev Set minimum swap amount
     */
    function setMinSwapAmount(uint256 _minSwapAmount) external onlyOwner {
        minSwapAmount = _minSwapAmount;
    }
    
    /**
     * @dev Rescues random funds stuck that the contract can't handle.
     */
    function inCaseTokensGetStuck(address _token) external onlyOwner nonReentrant {
        require(_token != address(getVaultToken(TokenValidator.Type.TokenX)) 
                && _token != address(getVaultToken(TokenValidator.Type.TokenY)), "Unknown token type");
        uint256 amount = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(msg.sender, amount);
    }
    
    /**
     * @dev Updates the rewarder address
     */
    function setRewarder(address _rewarder) external onlyOwner {
        require(_rewarder != address(0), "Invalid rewarder address");
        vaultConfig.rewarder = _rewarder;
    }

    // Override functions for backward compatibility with ERC20
    
    /**
     * @dev Get user's total shares (for backwards compatibility)
     */
    function balanceSharesCombined(address account) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < TOKEN_COUNT; i++) {
            total += shares[account][i];
        }

        return total;
    }

    /**
     * @dev Get user's share breakdown
     */
    function getUserShares(address user) external view returns (uint256 userSharesX, uint256 userSharesY) {
        return (shares[user][uint256(TokenValidator.Type.TokenX)], shares[user][uint256(TokenValidator.Type.TokenY)]);
    }
}
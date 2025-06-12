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

//Fee manager Interface is missing still
//Still missing applicable fees

/**
 * @dev Implementation of a vault with queued deposits and withdrawals
 * Separate share tracking for tokenX and tokenY
 * This contract receives funds and users interface with it.
 * Rebalancing functionality processes queues and manages liquidity.
 * Enhanced with METRO reward claiming and automatic compounding functionality.
 */
contract arcaTestnetV1 is ERC20Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // Structs for queue management
    struct DepositRequest {
        address user;
        uint256 amount;
        bool isTokenX; // true for tokenX, false for tokenY
        uint256 timestamp;
    }
    
    struct WithdrawRequest {
        address user;
        uint256 sharesX;
        uint256 sharesY;
        uint256 timestamp;
    }

    struct VaultConfig {
        address tokenX;        // Main token X that the vault will hold
        address tokenY;        // Main token Y that the vault will hold
        uint16 binStep;        // The bin step for liquidity positions
        uint256 amountXMin;    // Minimum amount of token X to add during rebalance
        uint256 amountYMin;    // Minimum amount of token Y to add during rebalance
        uint256 idSlippage;    // The number of bins to slip
        address lbRouter;      // Address of the LB Router
        address lbpAMM;        // Address of the Metro-S AMM LP pair
        address lbpContract;   // Address of the LBP contract
        address rewarder;      // Address of the LBHooksBaseRewarder contract
        address rewardToken;   // Address of the reward token (METRO)
    }

    VaultConfig private vaultConfig;
    
    // Native token address (WAVAX or similar)
    address public nativeToken;
    
    // Swap paths for METRO -> tokenX and METRO -> tokenY
    ILBRouter.Path public metroToTokenXPath;
    ILBRouter.Path public metroToTokenYPath;
    ILBRouter.Path public metroToNativePath;
    
    // Minimum amounts for swapping (to avoid dust)
    uint256 public minSwapAmount;

    // Store bin IDs from last add liquidity operation
    uint256[] public lastAddLiquidityBinIds;
    
    // Separate share tracking
    uint256 public totalSharesX;
    uint256 public totalSharesY;
    mapping(address => uint256) public sharesX;
    mapping(address => uint256) public sharesY;
    
    // Queue management
    DepositRequest[] public depositQueue;
    WithdrawRequest[] public withdrawQueue;
    uint256 public depositQueueStart;
    uint256 public withdrawQueueStart;
    
    // Track tokens waiting in queues
    uint256 public queuedTokenX;
    uint256 public queuedTokenY;
    
    // Compounding tracking
    uint256 public totalCompoundedX; // Total tokenX compounded from rewards
    uint256 public totalCompoundedY; // Total tokenY compounded from rewards
    
    // Events
    event DepositQueued(address indexed user, uint256 amount, bool isTokenX);
    event WithdrawQueued(address indexed user, uint256 sharesX, uint256 sharesY);
    event SharesMinted(address indexed user, uint256 sharesX, uint256 sharesY);
    event WithdrawProcessed(address indexed user, uint256 amountX, uint256 amountY);
    
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
        address _lbpContract,
        address _rewarder,
        address _rewardToken,
        address _nativeToken
    ) public initializer {
        __ERC20_init(_name, _symbol);
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        
        vaultConfig = VaultConfig(_tokenX, _tokenY, _binStep, _amountXMin, _amountYMin, _idSlippage, _lbRouter, _lbpContract, _rewarder, _rewardToken);
        nativeToken = _nativeToken;
        
        depositQueueStart = 0;
        withdrawQueueStart = 0;
        minSwapAmount = 10; // 0.001 METRO minimum
    }

    /**
     * @dev It calculates the total underlying value of tokenX held by the system.
     * It takes into account the vault contract balance excluding queued tokens.
     */
    function balanceX() public view returns (uint256) {
        return IERC20(vaultConfig.tokenX).balanceOf(address(this)) - queuedTokenX;
    }

    /**
     * @dev It calculates the total underlying value of tokenY held by the system.
     * It takes into account the vault contract balance excluding queued tokens.
     */
    function balanceY() public view returns (uint256) {
        return IERC20(vaultConfig.tokenY).balanceOf(address(this)) - queuedTokenY;
    }

    function totalSupplyX() public view returns (uint256) {
        return totalSharesX;
    }

    /**
     * @dev Function for various UIs to display the current value of one of our yield tokens.
     * Returns an uint256 with 18 decimals of how much underlying asset one vault share represents.
     * This is a simplified implementation that considers only tokenX for share value calculation.
     */
    function getPricePerFullShareX() public view returns (uint256) {
        return totalSupplyX() == 0 ? 1e18 : balanceX() * 1e18 / totalSupplyX();
    }

    /**
     * @dev Get total supply for tokenY shares (for backwards compatibility)
     */
    function totalSupplyY() public view returns (uint256) {
        return totalSharesY;
    }

    /**
     * @dev Function for various UIs to display the current value of one of our yield tokens.
     * Returns an uint256 with 18 decimals of how much underlying asset one vault share represents.
     * This is a simplified implementation that considers only tokenY for share value calculation.
     */
    function getPricePerFullShareY() public view returns (uint256) {
        return totalSupplyY() == 0 ? 1e18 : balanceY() * 1e18 / totalSupplyY();
    }

    /**
     * @dev A helper function to call depositX() with all the sender's funds.
     */
    function depositAllX() external {
        depositX(IERC20(vaultConfig.tokenX).balanceOf(msg.sender));
    }

    /**
     * @dev A helper function to call depositY() with all the sender's funds.
     */
    function depositAllY() external {
        depositY(IERC20(vaultConfig.tokenY).balanceOf(msg.sender));
    }

    /**
     * @dev Modified deposit function for tokenX - now adds to queue instead of immediate minting
     * Tokens are held in contract until next rebalance. Necessary for the rebalance and will help to calculate Shares.
     */
    function depositX(uint256 _amount) public nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 _pool = IERC20(vaultConfig.tokenX).balanceOf(address(this));
        IERC20(vaultConfig.tokenX).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = IERC20(vaultConfig.tokenX).balanceOf(address(this));
        _amount = _after - _pool;
        
        // Calculate and collect deposit fee
        uint256 depositFee = (_amount * feeManager.getDepositFee()) / BASIS_POINTS;
        uint256 netAmount = _amount - depositFee;
        
        if (depositFee > 0) {
            IERC20(vaultConfig.tokenX).safeTransfer(feeManager.getFeeRecipient(), depositFee);
            emit FeeCollected(feeManager.getFeeRecipient(), depositFee, "deposit");
        }
        
        // Add to deposit queue with net amount
        depositQueue.push(DepositRequest({
            user: msg.sender,
            amount: _amount,
            isTokenX: true,
            timestamp: block.timestamp
        }));
        
        // Track queued tokens
        queuedTokenX += _amount;
        
        emit DepositQueued(msg.sender, _amount, true);
    }

    /**
     * @dev Modified deposit function for tokenY - now adds to queue instead of immediate minting
     * Tokens are held in contract until next rebalance
     */
    function depositY(uint256 _amount) public nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 _pool = IERC20(vaultConfig.tokenY).balanceOf(address(this));
        IERC20(vaultConfig.tokenY).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = IERC20(vaultConfig.tokenY).balanceOf(address(this));
        _amount = _after - _pool;
        
        // Calculate and collect deposit fee
        uint256 depositFee = (_amount * feeManager.getDepositFee()) / BASIS_POINTS;
        uint256 netAmount = _amount - depositFee;
        
        if (depositFee > 0) {
            IERC20(vaultConfig.tokenY).safeTransfer(feeManager.getFeeRecipient(), depositFee);
            emit FeeCollected(feeManager.getFeeRecipient(), depositFee, "deposit");
        }
        
        // Add to deposit queue with net amount
        depositQueue.push(DepositRequest({
            user: msg.sender,
            amount: _amount,
            isTokenX: false,
            timestamp: block.timestamp
        }));
        
        // Track queued tokens
        queuedTokenY += _amount;
        
        emit DepositQueued(msg.sender, _amount, false);
    }

    /**
     * @dev Helper function to withdraw all shares
     */
    function withdrawAll() external {
        withdraw(sharesX[msg.sender], sharesY[msg.sender]);
    }

    /**
     * @dev Modified withdraw function - now adds to queue instead of immediate withdrawal
     * User specifies how many sharesX and sharesY they want to withdraw
     * @param _sharesX Amount of X shares to withdraw
     * @param _sharesY Amount of Y shares to withdraw
     */
    function withdraw(uint256 _sharesX, uint256 _sharesY) public nonReentrant {
        require(_sharesX > 0 || _sharesY > 0, "Must withdraw some shares");
        require(sharesX[msg.sender] >= _sharesX, "Insufficient sharesX");
        require(sharesY[msg.sender] >= _sharesY, "Insufficient sharesY");
        
        // Add to withdraw queue
        withdrawQueue.push(WithdrawRequest({
            user: msg.sender,
            sharesX: _sharesX,
            sharesY: _sharesY,
            timestamp: block.timestamp
        }));
        
        emit WithdrawQueued(msg.sender, _sharesX, _sharesY);
    }

    /**
     * @dev Backward compatibility function - converts to separate share withdrawal
     */
    function withdraw(uint256 _shares) public nonReentrant {
        uint256 totalUserShares = sharesX[msg.sender] + sharesY[msg.sender];
        require(totalUserShares >= _shares, "Insufficient shares");
        
        // Proportionally withdraw from both types
        uint256 withdrawSharesX = 0;
        uint256 withdrawSharesY = 0;
        
        if (sharesX[msg.sender] > 0) {
            withdrawSharesX = (_shares * sharesX[msg.sender]) / totalUserShares;
        }
        if (sharesY[msg.sender] > 0) {
            withdrawSharesY = (_shares * sharesY[msg.sender]) / totalUserShares;
        }
        
        withdraw(withdrawSharesX, withdrawSharesY);
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
                IERC20(vaultConfig.tokenX),
                IERC20(vaultConfig.tokenY), 
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
        uint256 withdrawsProcessed = _processWithdrawQueue(amountXRemoved, amountYRemoved);
        
        // Step 4: Process deposit queue (mint shares based on current state including compounded rewards)
        uint256 depositsProcessed = _processDepositQueue();
        
        // Add liquidity with remaining tokens
        uint256 availableTokenX = balanceX();
        uint256 availableTokenY = balanceY();
        
        if (availableTokenX > 0 || availableTokenY > 0) {
            // Approve and add liquidity
            if (availableTokenX > 0) {
                IERC20(vaultConfig.tokenX).approve(vaultConfig.lbRouter, 0);
                IERC20(vaultConfig.tokenX).approve(vaultConfig.lbRouter, availableTokenX);
            }
            
            if (availableTokenY > 0) {
                IERC20(vaultConfig.tokenY).approve(vaultConfig.lbRouter, 0);
                IERC20(vaultConfig.tokenY).approve(vaultConfig.lbRouter, availableTokenY);
            }
            
            ILBRouter.LiquidityParameters memory liquidityParams = ILBRouter.LiquidityParameters({
                tokenX: IERC20(vaultConfig.tokenX),
                tokenY: IERC20(vaultConfig.tokenY),
                binStep: vaultConfig.binStep,
                amountX: availableTokenX,
                amountY: availableTokenY,
                amountXMin: vaultConfig.amountXMin,
                amountYMin: vaultConfig.amountYMin,
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
        
        emit Rebalanced(vaultConfig.tokenX, vaultConfig.tokenY, amountXAdded, amountYAdded, amountXRemoved, amountYRemoved, depositsProcessed, withdrawsProcessed);
        
        return (amountXAdded, amountYAdded, amountXRemoved, amountYRemoved);
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
                uint256 performanceFee = (metroClaimed * feeManager.getPerformanceFee()) / BASIS_POINTS;
                uint256 netMetro = metroClaimed - performanceFee;
                
                // Send performance fee to fee recipient
                if (performanceFee > 0) {
                    IERC20(vaultConfig.rewardToken).safeTransfer(feeManager.getFeeRecipient(), performanceFee);
                    emit FeeCollected(feeManager.getFeeRecipient(), performanceFee, "performance");
                }
                
                // Compound the remaining rewards
                uint256 metroForTokenX = netMetro / 2;
                uint256 metroForTokenY = netMetro - metroForTokenX;
                
                uint256 tokenXObtained = 0;
                uint256 tokenYObtained = 0;
                
                // Swap METRO to tokenX
                if (metroForTokenX > 0) {
                    tokenXObtained = _swapMetroToToken(metroForTokenX, vaultConfig.tokenX, metroToTokenXPath);
                }
                
                // Swap METRO to tokenY
                if (metroForTokenY > 0) {
                    tokenYObtained = _swapMetroToToken(metroForTokenY, vaultConfig.tokenY, metroToTokenYPath);
                }
                
                // Update compounding totals - these tokens increase share value
                totalCompoundedX += tokenXObtained;
                totalCompoundedY += tokenYObtained;
                
                emit RewardsClaimed(vaultConfig.rewarder, vaultConfig.rewardToken, metroClaimed);
                emit RewardsCompounded(metroClaimed, tokenXObtained, tokenYObtained);
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
        uint metroAmount,
        address targetToken
    ) public returns(uint expectedOutput) {
        
        routerPair = ILBPair(vaultConfig.lbpContract);
        routerMetro = ILBAMM(vaultConfig.lbpAMM);
        
        uint decimals;
        uint metroDecimals = 18; // Assuming METRO has 18 decimals
        
        // Set decimals based on target token
        if(targetToken == vaultConfig.tokenX) {
            decimals = 18; // S token decimals
        } else {
            decimals = 6;  // USDC decimals
        }
        
        // Get current active bin ID and price
        uint activeID = routerPair.getActiveID(); 
        uint rawPrice = routerPair.getPriceFromID(activeID);
        
        // Convert 128.128 fixed-point price to human readable
        uint256 scale = 2**128;
        uint256 pricePerUnit; // Price of 1 METRO in terms of target token
        
        if(targetToken == vaultConfig.tokenX) {
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
        uint grossOutput = (metroAmount * pricePerUnit) / (10**metroDecimals);
        
        // Apply slippage protection (e.g., 0.5% slippage tolerance)
        uint slippageBasisPoints = 50; // 0.5% = 50 basis points
        uint slippageFactor = 10000 - slippageBasisPoints; // 9950
        
        // Calculate minimal expected output with slippage protection
        expectedOutput = (grossOutput * slippageFactor) / 10000;
        
        return expectedOutput;
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
        uint256 expectedOut = getExpectedSwapOutput(metroAmount, targetToken);
        uint256 minAmountOut = expectedOut * (10000 - maxSlippageBPS) / 10000; // - Already calculated in getExpectedSwapOutput?

        try ILBRouter(vaultConfig.lbRouter).swapExactTokensForTokens(
            metroAmount,
            minAmountOut, // Proper slippage protection
            swapPath,
            address(this),
            block.timestamp + 300
        ) returns (uint256 amountOutReturned) {
            uint256 balanceAfter = IERC20(targetToken).balanceOf(address(this));
            amountOut = balanceAfter - balanceBefore;
        } catch {
            // Swap failed, try native swap if target is not native
            if (targetToken != nativeToken && metroToNativePath.tokenPath.length > 0) {
                try ILBRouter(vaultConfig.lbRouter).swapExactTokensForNATIVE(
                    metroAmount,
                    0,
                    metroToNativePath,
                    address(this),
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
     * @dev Internal function to process withdraw queue
     * Calculates each user's share of withdrawn tokens and processes their withdrawal
     */
    function _processWithdrawQueue(uint256 totalXRemoved, uint256 totalYRemoved) internal returns (uint256 processed) {
        uint256 queueLength = withdrawQueue.length;
        
        for (uint256 i = withdrawQueueStart; i < queueLength; i++) {
            WithdrawRequest memory request = withdrawQueue[i];
            
            // Calculate user's share of withdrawn tokens
            uint256 userAmountX = 0;
            uint256 userAmountY = 0;
            
            if (request.sharesX > 0 && totalSharesX > 0) {
                // Share of removed liquidity
                userAmountX = (totalXRemoved * request.sharesX) / totalSharesX;
                uint256 existingX = balanceX();
                if (existingX > 0) {
                    userAmountX += (existingX * request.sharesX) / totalSharesX;
                }
            }
            
            if (request.sharesY > 0 && totalSharesY > 0) {
                // Share of removed liquidity
                userAmountY = (totalYRemoved * request.sharesY) / totalSharesY;
                uint256 existingY = balanceY();
                if (existingY > 0) {
                    userAmountY += (existingY * request.sharesY) / totalSharesY;
                }
            }
            
            // Calculate withdraw fee on total withdrawal amount
            uint256 totalWithdrawAmount = userAmountX + userAmountY;
            uint256 withdrawFee = (totalWithdrawAmount * feeManager.getWithdrawFee()) / BASIS_POINTS;
            
            // Apply fee proportionally to both tokens
            if (withdrawFee > 0 && totalWithdrawAmount > 0) {
                uint256 feeX = (userAmountX * withdrawFee) / totalWithdrawAmount;
                uint256 feeY = (userAmountY * withdrawFee) / totalWithdrawAmount;
                
                userAmountX -= feeX;
                userAmountY -= feeY;
                
                // Send fees to fee recipient
                if (feeX > 0) {
                    IERC20(vaultConfig.tokenX).safeTransfer(feeManager.getFeeRecipient(), feeX);
                }
                if (feeY > 0) {
                    IERC20(vaultConfig.tokenY).safeTransfer(feeManager.getFeeRecipient(), feeY);
                }
                
                emit FeeCollected(feeManager.getFeeRecipient(), withdrawFee, "withdraw");
            }
            
            // Burn user's shares
            sharesX[request.user] -= request.sharesX;
            sharesY[request.user] -= request.sharesY;
            totalSharesX -= request.sharesX;
            totalSharesY -= request.sharesY;
            
            // Transfer tokens to user
            if (userAmountX > 0) {
                IERC20(vaultConfig.tokenX).safeTransfer(request.user, userAmountX);
            }
            if (userAmountY > 0) {
                IERC20(vaultConfig.tokenY).safeTransfer(request.user, userAmountY);
            }
            
            emit WithdrawProcessed(request.user, userAmountX, userAmountY);
            processed++;
        }
        
        // Clear processed withdrawals
        if (processed > 0) {
            withdrawQueueStart = queueLength;
        }
        
        return processed;
    }

    /**
     * @dev Internal function to process deposit queue
     * Mints shares based on current token balances after withdrawals are processed and rewards compounded
     */
    function _processDepositQueue() internal returns (uint256 processed) {
        uint256 queueLength = depositQueue.length;
            
        for (uint256 i = depositQueueStart; i < queueLength; i++) {
            DepositRequest memory request = depositQueue[i];
            
            uint256 newShares = 0;
            
            if (request.isTokenX) {
                // Calculate sharesX to mint (benefits from compounded rewards increasing balance)
                if (totalSharesX == 0) {
                    newShares = request.amount;
                } else {
                    uint256 currentBalanceX = balanceX();
                    if (currentBalanceX > 0) {
                        newShares = (request.amount * totalSharesX) / currentBalanceX;
                    } else {
                        newShares = request.amount; // Fallback if no balance
                    }
                }
                
                // Update user shares and totals AFTER calculation
                sharesX[request.user] += newShares;
                totalSharesX += newShares;
                
                // Remove from queued tokens (this adds to available balance for next person)
                queuedTokenX -= request.amount;
                
            } else {
                // Calculate sharesY to mint (benefits from compounded rewards increasing balance)
                if (totalSharesY == 0) {
                    newShares = request.amount;
                } else {
                    uint256 currentBalanceY = balanceY();
                    if (currentBalanceY > 0) {
                        newShares = (request.amount * totalSharesY) / currentBalanceY;
                    } else {
                        newShares = request.amount; // Fallback if no balance
                    }
                }
                
                // Update user shares and totals AFTER calculation
                sharesY[request.user] += newShares;
                totalSharesY += newShares;
                
                // Remove from queued tokens (this adds to available balance for next person)
                queuedTokenY -= request.amount;
            }
            
            emit SharesMinted(request.user, request.isTokenX ? newShares : 0, request.isTokenX ? 0 : newShares);
            processed++;
        }
        
        // Clear processed deposits
        if (processed > 0) {
            depositQueueStart = queueLength;
        }
        
        return processed;
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
        metroToTokenXPath = _metroToTokenXPath;
        metroToTokenYPath = _metroToTokenYPath;
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
        require(_token != vaultConfig.tokenX && _token != vaultConfig.tokenY, "Cannot withdraw vault tokens");
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
    function balanceSharesCombined(address account) public view override returns (uint256) {
        return sharesX[account] + sharesY[account];
    }



    // View functions for queue management

    /**
     * @dev Get deposit queue length
     */
    function getDepositQueueLength() external view returns (uint256) {
        return depositQueue.length;
    }

    /**
     * @dev Get withdraw queue length
     */
    function getWithdrawQueueLength() external view returns (uint256) {
        return withdrawQueue.length;
    }

    /**
     * @dev Get pending deposits count
     */
    function getPendingDepositsCount() external view returns (uint256) {
        return depositQueue.length - depositQueueStart;
    }

    /**
     * @dev Get pending withdrawals count
     */
    function getPendingWithdrawsCount() external view returns (uint256) {
        return withdrawQueue.length - withdrawQueueStart;
    }

    /**
     * @dev Get user's share breakdown
     */
    function getUserShares(address user) external view returns (uint256 userSharesX, uint256 userSharesY) {
        return (sharesX[user], sharesY[user]);
    }
}
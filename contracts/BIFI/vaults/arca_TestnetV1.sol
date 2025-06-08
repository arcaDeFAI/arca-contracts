pragma solidity ^0.8.25;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./interfaces/ILBRouter.sol";
import "./interfaces/ILBHooksBaseRewarder.sol";
import "./interfaces/ILBPair.sol";
// import "./interfaces/ILBAMM.sol";  -We have to find the interface for the AMM LP Pools on Metropolis




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
    using SafeERC20Upgradeable for IERC20Upgradeable;

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

    // Swap path structure for LB Router
    struct SwapPath {
        uint256[] pairBinSteps;
        uint8[] versions;
        address[] tokenPath;
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
    
    // Native token address (WAVAX or similar)
    address public nativeToken;
    
    // Swap paths for METRO -> tokenX and METRO -> tokenY
    SwapPath public metroToTokenXPath;
    SwapPath public metroToTokenYPath;
    SwapPath public metroToNativePath;
    
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
        __Ownable_init();
        __ReentrancyGuard_init();
        
        tokenX = _tokenX;
        tokenY = _tokenY;
        binStep = _binStep;
        amountXMin = _amountXMin;
        amountYMin = _amountYMin;
        idSlippage = _idSlippage;
        lbRouter = _lbRouter;
        lbpContract = _lbpContract;
        rewarder = _rewarder;
        rewardToken = _rewardToken;
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
        return IERC20Upgradeable(tokenX).balanceOf(address(this)) - queuedTokenX;
    }

    /**
     * @dev It calculates the total underlying value of tokenY held by the system.
     * It takes into account the vault contract balance excluding queued tokens.
     */
    function balanceY() public view returns (uint256) {
        return IERC20Upgradeable(tokenY).balanceOf(address(this)) - queuedTokenY;
    }

    /**
     * @dev Custom logic in here for how much the vault allows to be borrowed.
     * We return available tokens excluding queued amounts.
     */
    function availableX() public view returns (uint256) {
        return IERC20Upgradeable(tokenX).balanceOf(address(this)) - queuedTokenX;
    }

    /**
     * @dev Custom logic in here for how much the vault allows to be borrowed.
     * We return available tokens excluding queued amounts.
     */
    function availableY() public view returns (uint256) {
        return IERC20Upgradeable(tokenY).balanceOf(address(this)) - queuedTokenY;
    }

    /**
     * @dev Get total supply for tokenX Shares (for backwards compatibility)
     */
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
        depositX(IERC20Upgradeable(tokenX).balanceOf(msg.sender));
    }

    /**
     * @dev A helper function to call depositY() with all the sender's funds.
     */
    function depositAllY() external {
        depositY(IERC20Upgradeable(tokenY).balanceOf(msg.sender));
    }

    /**
     * @dev Modified deposit function for tokenX - now adds to queue instead of immediate minting
     * Tokens are held in contract until next rebalance. Necessary for the rebalance and will help to calculate Shares.
     */
    function depositX(uint256 _amount) public nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 _pool = IERC20Upgradeable(tokenX).balanceOf(address(this));
        IERC20Upgradeable(tokenX).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = IERC20Upgradeable(tokenX).balanceOf(address(this));
        _amount = _after - _pool; // Additional check for deflationary tokens
        
        // Add to deposit queue
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
        
        uint256 _pool = IERC20Upgradeable(tokenY).balanceOf(address(this));
        IERC20Upgradeable(tokenY).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = IERC20Upgradeable(tokenY).balanceOf(address(this));
        _amount = _after - _pool; // Additional check for deflationary tokens
        
        // Add to deposit queue
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

    /**
     * @dev Enhanced rebalance function with METRO claiming and compounding
     * 1. Remove liquidity first
     * 2. Claim METRO rewards and compound them
     * 3. Process withdraw queue (fulfill withdrawals and burn shares)
     * 4. Process deposit queue (mint shares)
     * 5. Add liquidity with remaining tokens
     */
    function rebalance(
        // uint256 activeIdDesired,
        int256[] calldata deltaIds,
        uint256[] calldata distributionX,
        uint256[] calldata distributionY,
        // Remove liquidity params
        uint256[] calldata ids,
        uint256[] calldata amounts,
        uint256 removeAmountXMin,
        uint256 removeAmountYMin,
        // Shared params
        address to,
        address refundTo,
        uint256 deadline,
        // Control param
        bool forceRebalance
    ) external onlyOwner nonReentrant returns (
        uint256 amountXAdded,
        uint256 amountYAdded,
        uint256 amountXRemoved,
        uint256 amountYRemoved
    ) {
        require(block.timestamp <= deadline, "Transaction expired");
        
        // Step 1: Remove liquidity if needed
        if ((forceRebalance || ids.length > 0) && amounts.length > 0) {
            require(ids.length == amounts.length, "Array lengths must match");
            
            (amountXRemoved, amountYRemoved) = ILBRouter(lbRouter).removeLiquidity(
                tokenX,
                tokenY, 
                binStep,
                removeAmountXMin,
                removeAmountYMin,
                ids,
                amounts,
                address(this),
                deadline
            );
        }
        
        // Step 2: Claim and compound METRO rewards BEFORE processing queues
        _claimAndCompoundRewards();
        
        // Step 3: Process withdraw queue FIRST (before calculating deposit shares)
        uint256 withdrawsProcessed = _processWithdrawQueue(amountXRemoved, amountYRemoved);
        
        // Step 4: Process deposit queue (mint shares based on current state including compounded rewards)
        uint256 depositsProcessed = _processDepositQueue();
        
        // Step 5: Add liquidity with remaining available tokens
        uint256 availableTokenX = availableX();
        uint256 availableTokenY = availableY();
        
        if (availableTokenX > 0 || availableTokenY > 0) {
            // Approve and add liquidity
            if (availableTokenX > 0) {
                IERC20Upgradeable(tokenX).safeApprove(lbRouter, 0);
                IERC20Upgradeable(tokenX).safeApprove(lbRouter, availableTokenX);
            }
            
            if (availableTokenY > 0) {
                IERC20Upgradeable(tokenY).safeApprove(lbRouter, 0);
                IERC20Upgradeable(tokenY).safeApprove(lbRouter, availableTokenY);
            }
            
            ILBRouter.LiquidityParameters memory liquidityParams = ILBRouter.LiquidityParameters({
                tokenX: tokenX,
                tokenY: tokenY,
                binStep: binStep,
                amountX: availableTokenX,
                amountY: availableTokenY,
                amountXMin: amountXMin,
                amountYMin: amountYMin,
                activeIdDesired: ILBPair(lbpContract).getActiveID(),
                idSlippage: idSlippage,
                deltaIds: deltaIds,
                distributionX: distributionX,
                distributionY: distributionY,
                to: to,
                refundTo: refundTo,
                deadline: deadline
            });
            
            (amountXAdded, amountYAdded) = ILBRouter(lbRouter).addLiquidity(liquidityParams);
        }
        
        emit Rebalanced(tokenX, tokenY, amountXAdded, amountYAdded, amountXRemoved, amountYRemoved, depositsProcessed, withdrawsProcessed);
        
        return (amountXAdded, amountYAdded, amountXRemoved, amountYRemoved);
    }

    /**
     * @dev Claims METRO rewards and compounds them into tokenX and tokenY
     * This increases the value of existing shares without minting new ones
     */
    function _claimAndCompoundRewards() internal {
        if (rewarder == address(0)) return;
        
        // Get bin IDs where we have positions
        uint256[] memory binIds = getVaultBinIds();
        if (binIds.length == 0) return;
        
        // Get balance before claiming
        uint256 metroBalanceBefore = IERC20Upgradeable(rewardToken).balanceOf(address(this));
        
        // Claim METRO rewards
        try ILBHooksBaseRewarder(rewarder).claim(address(this), binIds) {
            // Calculate claimed amount
            uint256 metroBalanceAfter = IERC20Upgradeable(rewardToken).balanceOf(address(this));
            uint256 metroClaimed = metroBalanceAfter - metroBalanceBefore;
            
            if (metroClaimed > minSwapAmount) {
                // Split METRO 50/50 and swap to tokenX and tokenY
                uint256 metroForTokenX = metroClaimed / 2;
                uint256 metroForTokenY = metroClaimed - metroForTokenX;
                
                uint256 tokenXObtained = 0;
                uint256 tokenYObtained = 0;
                
                // Swap METRO to tokenX
                if (metroForTokenX > 0) {
                    tokenXObtained = _swapMetroToToken(metroForTokenX, tokenX, metroToTokenXPath);
                }
                
                // Swap METRO to tokenY
                if (metroForTokenY > 0) {
                    tokenYObtained = _swapMetroToToken(metroForTokenY, tokenY, metroToTokenYPath);
                }
                
                // Update compounding totals - these tokens increase share value
                totalCompoundedX += tokenXObtained;
                totalCompoundedY += tokenYObtained;
                
                emit RewardsClaimed(rewarder, rewardToken, metroClaimed);
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
        
        routerPair = ILBPair(lbpContract);
        routerMetro = ILBAMM(lbpAMM);
        
        uint decimals;
        uint metroDecimals = 18; // Assuming METRO has 18 decimals
        
        // Set decimals based on target token
        if(targetToken == tokenX) {
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
        
        if(targetToken == tokenX) {
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
        SwapPath memory swapPath
    ) internal returns (uint256 amountOut) {
        if (metroAmount == 0 || swapPath.tokenPath.length == 0) return 0;
        
        // Approve METRO for router
        IERC20Upgradeable(rewardToken).safeApprove(lbRouter, 0);
        IERC20Upgradeable(rewardToken).safeApprove(lbRouter, metroAmount);
        
        uint256 balanceBefore = IERC20Upgradeable(targetToken).balanceOf(address(this));

        // Get expected output from price oracle
        uint256 expectedOut = getExpectedSwapOutput(metroAmount, targetToken);
        // uint256 minAmountOut = expectedOut * (10000 - maxSlippageBPS) / 10000; - Already calculated in getExpectedSwapOutput?

        try ILBRouter(lbRouter).swapExactTokensForTokens(
            metroAmount,
            minAmountOut, // Proper slippage protection
            swapPath,
            address(this),
            block.timestamp + 300
        ) returns (uint256 amountOutReturned) {
            // Verify actual received amount
            uint256 balanceAfter = IERC20Upgradeable(targetToken).balanceOf(address(this));
            amountOut = balanceAfter - balanceBefore;
        } catch {
            // Swap failed, try native swap if target is not native
            if (targetToken != nativeToken && metroToNativePath.tokenPath.length > 0) {
                try ILBRouter(lbRouter).swapExactTokensForNATIVE(
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
                // Also include their share of existing tokenX balance (including compounded rewards)
                uint256 existingX = availableX();
                if (existingX > 0) {
                    userAmountX += (existingX * request.sharesX) / totalSharesX;
                }
            }
            
            if (request.sharesY > 0 && totalSharesY > 0) {
                // Share of removed liquidity
                userAmountY = (totalYRemoved * request.sharesY) / totalSharesY;
                // Also include their share of existing tokenY balance (including compounded rewards)
                uint256 existingY = availableY();
                if (existingY > 0) {
                    userAmountY += (existingY * request.sharesY) / totalSharesY;
                }
            }
            
            // Burn user's shares
            sharesX[request.user] -= request.sharesX;
            sharesY[request.user] -= request.sharesY;
            totalSharesX -= request.sharesX;
            totalSharesY -= request.sharesY;
            
            // Transfer tokens to user
            if (userAmountX > 0) {
                IERC20Upgradeable(tokenX).safeTransfer(request.user, userAmountX);
            }
            if (userAmountY > 0) {
                IERC20Upgradeable(tokenY).safeTransfer(request.user, userAmountY);
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
                    uint256 currentBalanceX = availableX(); // This includes compounded tokenX
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
                    uint256 currentBalanceY = availableY(); // This includes compounded tokenY
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
        require(rewarder != address(0), "Rewarder not set");
        require(binIds.length > 0, "No bin IDs provided");
        require(receiver != address(0), "Invalid receiver address");
        
        // Get balance before claiming
        uint256 balanceBefore = IERC20Upgradeable(rewardToken).balanceOf(address(this));
        
        // Call the correct claim function
        ILBHooksBaseRewarder(rewarder).claim(receiver, binIds);
        
        // Calculate how much was actually claimed
        uint256 balanceAfter = IERC20Upgradeable(rewardToken).balanceOf(address(this));
        claimedAmount = balanceAfter - balanceBefore;
        
        emit RewardsClaimed(rewarder, rewardToken, claimedAmount);
        
        return claimedAmount;
    }

    /**
     * @dev Returns the bin IDs where the vault has LP positions
     */
    function getVaultBinIds() public view returns (uint256[] memory) {
        address lbPair = lbpContract;
        uint256 activeId = ILBPair(lbPair).getActiveId();
        
        uint256[] memory binIds = new uint256[](2 * idSlippage + 1);
        
        for (uint256 i = 0; i < 2 * idSlippage + 1; i++) {
            binIds[i] = activeId - idSlippage + i;
        }
        
        return binIds;
    }

    /**
     * @dev Set swap paths for METRO rewards
     */
    function setSwapPaths(
        SwapPath calldata _metroToTokenXPath,
        SwapPath calldata _metroToTokenYPath,
        SwapPath calldata _metroToNativePath
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
        require(_token != tokenX && _token != tokenY, "Cannot withdraw vault tokens");

        uint256 amount = IERC20Upgradeable(_token).balanceOf(address(this));
        IERC20Upgradeable(_token).safeTransfer(msg.sender, amount);
    }
    
    /**
     * @dev Updates the rewarder address
     */
    function setRewarder(address _rewarder) external onlyOwner {
        require(_rewarder != address(0), "Invalid rewarder address");
        rewarder = _rewarder;
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
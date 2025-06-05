pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./interfaces/ILBRouter.sol";
import "./interfaces/ILBHooksBaseRewarder.sol";
import "./interfaces/ILBPair.sol";

/**
 * @dev Implementation of a vault with queued deposits and withdrawals
 * Separate share tracking for tokenX and tokenY
 * This contract receives funds and users interface with it.
 * Rebalancing functionality processes queues and manages liquidity.
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

    // State variables 
    address public tokenX; // Main token X that the vault will hold
    address public tokenY; // Main token Y that the vault will hold
    uint16 public binStep; // The bin step for liquidity positions
    uint256 public amountXMin; // Minimum amount of token X to add during rebalance
    uint256 public amountYMin; // Minimum amount of token Y to add during rebalance
    uint256 public idSlippage; // The number of bins to slip
    address public lbRouter; // Address of the LB Router contract
    address public lbpContract; // Address of the LBP contract
    address public rewarder; // Address of the LBHooksBaseRewarder contract
    
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

    /**
     * @dev Initializes the vault's own token.
     * These tokens are minted when someone does a deposit. It is burned in order
     * to withdraw the corresponding portion of the underlying assets.
     * @param _tokenX the address of the tokenX that the vault will hold as underlying value.
     * @param _tokenY the address of the tokenY that the vault will hold as underlying value.
     * @param _binStep the bin step for the liquidity positions
     * @param _amountXMin the minimum amount of tokenX to add during rebalance
     * @param _amountYMin the minimum amount of tokenY to add during rebalance
     * @param _idSlippage the number of bins to slip
     * @param _name the name of the vault token ''Metronome WS-SCUSD Vault''.
     * @param _symbol the symbol of the vault token ''fanaWSSC.
     * @param _lbRouter the address of the LB Router
     * @param _lbpContract the address of the LBP contract
     * @param _rewarder the address of the LBHooksBaseRewarder contract for claiming.
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
        address _rewarder
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
        
        depositQueueStart = 0;
        withdrawQueueStart = 0;
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
     * @dev Function for various UIs to display the current value of one of our yield tokens.
     * Returns an uint256 with 18 decimals of how much underlying asset one vault share represents.
     * This is a simplified implementation that considers only tokenX for share value calculation.
     */
    function getPricePerFullShare() public view returns (uint256) {
        return totalSupply() == 0 ? 1e18 : balanceX() * 1e18 / totalSupply();
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
     * Tokens are held in contract until next rebalance
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
     * @dev Modified rebalance function that processes queues
     * 1. Remove liquidity first
     * 2. Process withdraw queue (fulfill withdrawals and burn shares)
     * 3. Process deposit queue (mint shares)
     * 4. Add liquidity with remaining tokens
     */
    function rebalance(
        uint256 activeIdDesired,
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
        
        // Step 2: Process withdraw queue FIRST (before calculating deposit shares)
        uint256 withdrawsProcessed = _processWithdrawQueue(amountXRemoved, amountYRemoved);
        
        // Step 3: Process deposit queue (mint shares based on current state)
        uint256 depositsProcessed = _processDepositQueue();
        
        // Step 4: Add liquidity with remaining available tokens
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
                activeIdDesired: activeIdDesired,
                idSlippage: idSlippage,
                deltaIds: deltaIds,
                distributionX: distributionX,
                distributionY: distributionY,
                to: to,
                refundTo: refundTo,
                deadline: deadline
            });
            
            (amountXAdded, amountYAdded,,,) = ILBRouter(lbRouter).addLiquidity(liquidityParams);
        }
        
        emit Rebalanced(tokenX, tokenY, amountXAdded, amountYAdded, amountXRemoved, amountYRemoved, depositsProcessed, withdrawsProcessed);
        
        return (amountXAdded, amountYAdded, amountXRemoved, amountYRemoved);
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
                // Also include their share of existing tokenX balance
                uint256 existingX = availableX();
                if (existingX > 0) {
                    userAmountX += (existingX * request.sharesX) / totalSharesX;
                }
            }
            
            if (request.sharesY > 0 && totalSharesY > 0) {
                // Share of removed liquidity
                userAmountY = (totalYRemoved * request.sharesY) / totalSharesY;
                // Also include their share of existing tokenY balance
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
     * Mints shares based on current token balances after withdrawals are processed
     */
    function _processDepositQueue() internal returns (uint256 processed) {
        uint256 queueLength = depositQueue.length;
        
        for (uint256 i = depositQueueStart; i < queueLength; i++) {
            DepositRequest memory request = depositQueue[i];
            
            uint256 newShares = 0;
            
            if (request.isTokenX) {
                // Calculate sharesX to mint
                if (totalSharesX == 0) {
                    newShares = request.amount;
                } else {
                    uint256 currentBalanceX = availableX();
                    if (currentBalanceX > 0) {
                        newShares = (request.amount * totalSharesX) / currentBalanceX;
                    } else {
                        newShares = request.amount; // Fallback if no balance
                    }
                }
                
                sharesX[request.user] += newShares;
                totalSharesX += newShares;
                queuedTokenX -= request.amount;
                
            } else {
                // Calculate sharesY to mint
                if (totalSharesY == 0) {
                    newShares = request.amount;
                } else {
                    uint256 currentBalanceY = availableY();
                    if (currentBalanceY > 0) {
                        newShares = (request.amount * totalSharesY) / currentBalanceY;
                    } else {
                        newShares = request.amount; // Fallback if no balance
                    }
                }
                
                sharesY[request.user] += newShares;
                totalSharesY += newShares;
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
     * @dev Claims rewards from the LBHooksBaseRewarder for LP positions
     */
    function claimRewards(
        address[] calldata rewardTokens,
        uint256[] calldata binIds,
        address receiver
    ) external onlyOwner nonReentrant returns (uint256[] memory claimedAmounts) {
        require(rewarder != address(0), "Rewarder not set");
        require(binIds.length > 0, "No bin IDs provided");
        require(receiver != address(0), "Invalid receiver address");
        
        address lbPair = lbpContract;
        require(lbPair != address(0), "LBPair not set");
        
        claimedAmounts = ILBHooksBaseRewarder(rewarder).claim(
            lbPair,
            address(this),
            binIds,
            rewardTokens,
            receiver
        );
        
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            emit RewardsClaimed(rewarder, rewardTokens[i], claimedAmounts[i]);
        }
        
        return claimedAmounts;
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
     * @dev Rescues random funds stuck that the contract can't handle.
     */
    function inCaseTokensGetStuck(address _token) external onlyOwner {
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
    function balanceOf(address account) public view override returns (uint256) {
        return sharesX[account] + sharesY[account];
    }

    /**
     * @dev Get total supply (for backwards compatibility)
     */
    function totalSupply() public view override returns (uint256) {
        return totalSharesX + totalSharesY;
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
pragma solidity ^0.8.25;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./interfaces/ILBRouter.sol";
import "./interfaces/ILBHooksBaseRewarder.sol";
import "./interfaces/ILBPair.sol";

// Import the fee manager interface
interface IarcaFeeManager {
    function getDepositFee() external view returns (uint256);
    function getWithdrawFee() external view returns (uint256);
    function getPerformanceFee() external view returns (uint256);
    function getFeeRecipient() external view returns (address);
}

contract arcaTestnetV1 is ERC20Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Fee Manager
    IarcaFeeManager public feeManager;
    uint256 public constant BASIS_POINTS = 10000;

    // Structs for queue management
    struct DepositRequest {
        address user;
        uint256 amount;
        bool isTokenX;
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

    // Configuration
    address public tokenX;
    address public tokenY;
    uint16 public binStep;
    uint256 public amountXMin;
    uint256 public amountYMin;
    uint256 public idSlippage;
    address public lbRouter;
    address public lbpAMM;
    address public lbpContract;
    address public rewarder;
    address public rewardToken;
    address public nativeToken;
    
    // Swap paths for METRO rewards
    SwapPath public metroToTokenXPath;
    SwapPath public metroToTokenYPath;
    SwapPath public metroToNativePath;
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
    uint256 public totalCompoundedX;
    uint256 public totalCompoundedY;
    
    // Events
    event DepositQueued(address indexed user, uint256 amount, bool isTokenX, uint256 feeAmount);
    event WithdrawQueued(address indexed user, uint256 sharesX, uint256 sharesY);
    event SharesMinted(address indexed user, uint256 sharesX, uint256 sharesY);
    event WithdrawProcessed(address indexed user, uint256 amountX, uint256 amountY, uint256 feeAmount);
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
    
    event RewardsClaimed(address rewarder, address token, uint256 amount);
    event RewardsCompounded(uint256 metroAmount, uint256 tokenXCompounded, uint256 tokenYCompounded, uint256 performanceFee);

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
        address _nativeToken,
        address _feeManager
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
        feeManager = IarcaFeeManager(_feeManager);
        
        depositQueueStart = 0;
        withdrawQueueStart = 0;
        minSwapAmount = 10;
    }

    function balanceX() public view returns (uint256) {
        return IERC20Upgradeable(tokenX).balanceOf(address(this)) - queuedTokenX;
    }

    function balanceY() public view returns (uint256) {
        return IERC20Upgradeable(tokenY).balanceOf(address(this)) - queuedTokenY;
    }

    function availableX() public view returns (uint256) {
        return IERC20Upgradeable(tokenX).balanceOf(address(this)) - queuedTokenX;
    }

    function availableY() public view returns (uint256) {
        return IERC20Upgradeable(tokenY).balanceOf(address(this)) - queuedTokenY;
    }

    function totalSupplyX() public view returns (uint256) {
        return totalSharesX;
    }

    function getPricePerFullShareX() public view returns (uint256) {
        return totalSupplyX() == 0 ? 1e18 : balanceX() * 1e18 / totalSupplyX();
    }

    function totalSupplyY() public view returns (uint256) {
        return totalSharesY;
    }

    function getPricePerFullShareY() public view returns (uint256) {
        return totalSupplyY() == 0 ? 1e18 : balanceY() * 1e18 / totalSupplyY();
    }

    function depositAllX() external {
        depositX(IERC20Upgradeable(tokenX).balanceOf(msg.sender));
    }

    function depositAllY() external {
        depositY(IERC20Upgradeable(tokenY).balanceOf(msg.sender));
    }

    function depositX(uint256 _amount) public nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 _pool = IERC20Upgradeable(tokenX).balanceOf(address(this));
        IERC20Upgradeable(tokenX).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = IERC20Upgradeable(tokenX).balanceOf(address(this));
        _amount = _after - _pool;
        
        // Calculate and collect deposit fee
        uint256 depositFee = (_amount * feeManager.getDepositFee()) / BASIS_POINTS;
        uint256 netAmount = _amount - depositFee;
        
        if (depositFee > 0) {
            IERC20Upgradeable(tokenX).safeTransfer(feeManager.getFeeRecipient(), depositFee);
            emit FeeCollected(feeManager.getFeeRecipient(), depositFee, "deposit");
        }
        
        // Add to deposit queue with net amount
        depositQueue.push(DepositRequest({
            user: msg.sender,
            amount: netAmount,
            isTokenX: true,
            timestamp: block.timestamp
        }));
        
        queuedTokenX += netAmount;
        
        emit DepositQueued(msg.sender, netAmount, true, depositFee);
    }

    function depositY(uint256 _amount) public nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 _pool = IERC20Upgradeable(tokenY).balanceOf(address(this));
        IERC20Upgradeable(tokenY).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = IERC20Upgradeable(tokenY).balanceOf(address(this));
        _amount = _after - _pool;
        
        // Calculate and collect deposit fee
        uint256 depositFee = (_amount * feeManager.getDepositFee()) / BASIS_POINTS;
        uint256 netAmount = _amount - depositFee;
        
        if (depositFee > 0) {
            IERC20Upgradeable(tokenY).safeTransfer(feeManager.getFeeRecipient(), depositFee);
            emit FeeCollected(feeManager.getFeeRecipient(), depositFee, "deposit");
        }
        
        // Add to deposit queue with net amount
        depositQueue.push(DepositRequest({
            user: msg.sender,
            amount: netAmount,
            isTokenX: false,
            timestamp: block.timestamp
        }));
        
        queuedTokenY += netAmount;
        
        emit DepositQueued(msg.sender, netAmount, false, depositFee);
    }

    function withdrawAll() external {
        withdraw(sharesX[msg.sender], sharesY[msg.sender]);
    }

    function withdraw(uint256 _sharesX, uint256 _sharesY) public nonReentrant {
        require(_sharesX > 0 || _sharesY > 0, "Must withdraw some shares");
        require(sharesX[msg.sender] >= _sharesX, "Insufficient sharesX");
        require(sharesY[msg.sender] >= _sharesY, "Insufficient sharesY");
        
        withdrawQueue.push(WithdrawRequest({
            user: msg.sender,
            sharesX: _sharesX,
            sharesY: _sharesY,
            timestamp: block.timestamp
        }));
        
        emit WithdrawQueued(msg.sender, _sharesX, _sharesY);
    }

    function withdraw(uint256 _shares) public nonReentrant {
        uint256 totalUserShares = sharesX[msg.sender] + sharesY[msg.sender];
        require(totalUserShares >= _shares, "Insufficient shares");
        
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

    function rebalance(
        int256[] calldata deltaIds,
        uint256[] calldata distributionX,
        uint256[] calldata distributionY,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        uint256 removeAmountXMin,
        uint256 removeAmountYMin,
        address to,
        address refundTo,
        uint256 deadline,
        bool forceRebalance
    ) external onlyOwner nonReentrant returns (
        uint256 amountXAdded,
        uint256 amountYAdded,
        uint256 amountXRemoved,
        uint256 amountYRemoved
    ) {
        require(block.timestamp <= deadline, "Transaction expired");
        
        // Remove liquidity if needed
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
        
        // Claim and compound rewards with performance fee
        _claimAndCompoundRewards();
        
        // Process withdraw queue
        uint256 withdrawsProcessed = _processWithdrawQueue(amountXRemoved, amountYRemoved);
        
        // Process deposit queue
        uint256 depositsProcessed = _processDepositQueue();
        
        // Add liquidity with remaining tokens
        uint256 availableTokenX = availableX();
        uint256 availableTokenY = availableY();
        
        if (availableTokenX > 0 || availableTokenY > 0) {
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

    function _claimAndCompoundRewards() internal {
        if (rewarder == address(0)) return;
        
        uint256[] memory binIds = getVaultBinIds();
        if (binIds.length == 0) return;
        
        uint256 metroBalanceBefore = IERC20Upgradeable(rewardToken).balanceOf(address(this));
        
        try ILBHooksBaseRewarder(rewarder).claim(address(this), binIds) {
            uint256 metroBalanceAfter = IERC20Upgradeable(rewardToken).balanceOf(address(this));
            uint256 metroClaimed = metroBalanceAfter - metroBalanceBefore;
            
            if (metroClaimed > minSwapAmount) {
                // Calculate performance fee on claimed rewards
                uint256 performanceFee = (metroClaimed * feeManager.getPerformanceFee()) / BASIS_POINTS;
                uint256 netMetro = metroClaimed - performanceFee;
                
                // Send performance fee to fee recipient
                if (performanceFee > 0) {
                    IERC20Upgradeable(rewardToken).safeTransfer(feeManager.getFeeRecipient(), performanceFee);
                    emit FeeCollected(feeManager.getFeeRecipient(), performanceFee, "performance");
                }
                
                // Compound the remaining rewards
                uint256 metroForTokenX = netMetro / 2;
                uint256 metroForTokenY = netMetro - metroForTokenX;
                
                uint256 tokenXObtained = 0;
                uint256 tokenYObtained = 0;
                
                if (metroForTokenX > 0) {
                    tokenXObtained = _swapMetroToToken(metroForTokenX, tokenX, metroToTokenXPath);
                }
                
                if (metroForTokenY > 0) {
                    tokenYObtained = _swapMetroToToken(metroForTokenY, tokenY, metroToTokenYPath);
                }
                
                totalCompoundedX += tokenXObtained;
                totalCompoundedY += tokenYObtained;
                
                emit RewardsClaimed(rewarder, rewardToken, metroClaimed);
                emit RewardsCompounded(netMetro, tokenXObtained, tokenYObtained, performanceFee);
            }
        } catch {
            // Claiming failed, continue
        }
    }

    function _swapMetroToToken(
        uint256 metroAmount, 
        address targetToken, 
        SwapPath memory swapPath
    ) internal returns (uint256 amountOut) {
        if (metroAmount == 0 || swapPath.tokenPath.length == 0) return 0;
        
        IERC20Upgradeable(rewardToken).safeApprove(lbRouter, 0);
        IERC20Upgradeable(rewardToken).safeApprove(lbRouter, metroAmount);
        
        uint256 balanceBefore = IERC20Upgradeable(targetToken).balanceOf(address(this));

        try ILBRouter(lbRouter).swapExactTokensForTokens(
            metroAmount,
            0,
            swapPath,
            address(this),
            block.timestamp + 300
        ) returns (uint256 amountOutReturned) {
            uint256 balanceAfter = IERC20Upgradeable(targetToken).balanceOf(address(this));
            amountOut = balanceAfter - balanceBefore;
        } catch {
            // Swap failed
        }
        
        return amountOut;
    }

    function _processWithdrawQueue(uint256 totalXRemoved, uint256 totalYRemoved) internal returns (uint256 processed) {
        uint256 queueLength = withdrawQueue.length;
        
        for (uint256 i = withdrawQueueStart; i < queueLength; i++) {
            WithdrawRequest memory request = withdrawQueue[i];
            
            uint256 userAmountX = 0;
            uint256 userAmountY = 0;
            
            if (request.sharesX > 0 && totalSharesX > 0) {
                userAmountX = (totalXRemoved * request.sharesX) / totalSharesX;
                uint256 existingX = availableX();
                if (existingX > 0) {
                    userAmountX += (existingX * request.sharesX) / totalSharesX;
                }
            }
            
            if (request.sharesY > 0 && totalSharesY > 0) {
                userAmountY = (totalYRemoved * request.sharesY) / totalSharesY;
                uint256 existingY = availableY();
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
                    IERC20Upgradeable(tokenX).safeTransfer(feeManager.getFeeRecipient(), feeX);
                }
                if (feeY > 0) {
                    IERC20Upgradeable(tokenY).safeTransfer(feeManager.getFeeRecipient(), feeY);
                }
                
                emit FeeCollected(feeManager.getFeeRecipient(), withdrawFee, "withdraw");
            }
            
            // Burn user's shares
            sharesX[request.user] -= request.sharesX;
            sharesY[request.user] -= request.sharesY;
            totalSharesX -= request.sharesX;
            totalSharesY -= request.sharesY;
            
            // Transfer net amounts to user
            if (userAmountX > 0) {
                IERC20Upgradeable(tokenX).safeTransfer(request.user, userAmountX);
            }
            if (userAmountY > 0) {
                IERC20Upgradeable(tokenY).safeTransfer(request.user, userAmountY);
            }
            
            emit WithdrawProcessed(request.user, userAmountX, userAmountY, withdrawFee);
            processed++;
        }
        
        if (processed > 0) {
            withdrawQueueStart = queueLength;
        }
        
        return processed;
    }

    function _processDepositQueue() internal returns (uint256 processed) {
        uint256 queueLength = depositQueue.length;
            
        for (uint256 i = depositQueueStart; i < queueLength; i++) {
            DepositRequest memory request = depositQueue[i];
            
            uint256 newShares = 0;
            
            if (request.isTokenX) {
                if (totalSharesX == 0) {
                    newShares = request.amount;
                } else {
                    uint256 currentBalanceX = availableX();
                    if (currentBalanceX > 0) {
                        newShares = (request.amount * totalSharesX) / currentBalanceX;
                    } else {
                        newShares = request.amount;
                    }
                }
                
                sharesX[request.user] += newShares;
                totalSharesX += newShares;
                queuedTokenX -= request.amount;
                
            } else {
                if (totalSharesY == 0) {
                    newShares = request.amount;
                } else {
                    uint256 currentBalanceY = availableY();
                    if (currentBalanceY > 0) {
                        newShares = (request.amount * totalSharesY) / currentBalanceY;
                    } else {
                        newShares = request.amount;
                    }
                }
                
                sharesY[request.user] += newShares;
                totalSharesY += newShares;
                queuedTokenY -= request.amount;
            }
            
            emit SharesMinted(request.user, request.isTokenX ? newShares : 0, request.isTokenX ? 0 : newShares);
            processed++;
        }
        
        if (processed > 0) {
            depositQueueStart = queueLength;
        }
        
        return processed;
    }

    function getVaultBinIds() public view returns (uint256[] memory) {
        address lbPair = lbpContract;
        uint256 activeId = ILBPair(lbPair).getActiveId();
        
        uint256[] memory binIds = new uint256[](2 * idSlippage + 1);
        
        for (uint256 i = 0; i < 2 * idSlippage + 1; i++) {
            binIds[i] = activeId - idSlippage + i;
        }
        
        return binIds;
    }

    // Owner functions
    function setFeeManager(address _feeManager) external onlyOwner {
        require(_feeManager != address(0), "Invalid fee manager");
        feeManager = IarcaFeeManager(_feeManager);
    }

    function setSwapPaths(
        SwapPath calldata _metroToTokenXPath,
        SwapPath calldata _metroToTokenYPath,
        SwapPath calldata _metroToNativePath
    ) external onlyOwner {
        metroToTokenXPath = _metroToTokenXPath;
        metroToTokenYPath = _metroToTokenYPath;
        metroToNativePath = _metroToNativePath;
    }

    function setMinSwapAmount(uint256 _minSwapAmount) external onlyOwner {
        minSwapAmount = _minSwapAmount;
    }
    
    function inCaseTokensGetStuck(address _token) external onlyOwner nonReentrant {
        require(_token != tokenX && _token != tokenY, "Cannot withdraw vault tokens");
        uint256 amount = IERC20Upgradeable(_token).balanceOf(address(this));
        IERC20Upgradeable(_token).safeTransfer(msg.sender, amount);
    }
    
    function setRewarder(address _rewarder) external onlyOwner {
        require(_rewarder != address(0), "Invalid rewarder address");
        rewarder = _rewarder;
    }

    // View functions

    function getDepositQueueLength() external view returns (uint256) {
        return depositQueue.length;
    }

    function getWithdrawQueueLength() external view returns (uint256) {
        return withdrawQueue.length;
    }

    function getPendingDepositsCount() external view returns (uint256) {
        return depositQueue.length - depositQueueStart;
    }

    function getPendingWithdrawsCount() external view returns (uint256) {
        return withdrawQueue.length - withdrawQueueStart;
    }

    function getUserShares(address user) external view returns (uint256 userSharesX, uint256 userSharesY) {
        return (sharesX[user], sharesY[user]);
    }
}
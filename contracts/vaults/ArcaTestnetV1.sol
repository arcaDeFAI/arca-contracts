// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// TODO: Add maximum exposure limits per user
// TODO: Add emergency pause functionality
// TODO: Add minimum deposit amounts to prevent dust attacks
// TODO: Add maximum queue sizes to prevent DoS
// TODO: Add slippage protection for users during rebalancing

import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ILBRouter} from "../../lib/joe-v2/src/interfaces/ILBRouter.sol";
import {ILBPair} from "../../lib/joe-v2/src/interfaces/ILBPair.sol";
import {IArcaFeeManagerV1} from "../interfaces/IArcaFeeManagerV1.sol";
import {IArcaQueueHandlerV1} from "../interfaces/IArcaQueueHandlerV1.sol";
import {TokenValidator} from "../TokenTypes.sol";
import {IArcaRewardClaimerV1} from "../interfaces/IArcaRewardClaimerV1.sol";
import {
    IDepositWithdrawCompatible
} from "../interfaces/IDepositWithdrawCompatible.sol";

/**
 * @dev Implementation of a vault with queued deposits and withdrawals
 * Separate share tracking for tokenX and tokenY
 * This contract receives funds and users interface with it.
 * Rebalancing functionality processes queues and manages liquidity.
 * Enhanced with METRO reward claiming and automatic compounding functionality.
 */
contract ArcaTestnetV1 is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IDepositWithdrawCompatible,
    TokenValidator
{
    using SafeERC20 for IERC20;

    function getVaultToken(
        TokenValidator.Type tokenType
    ) private view returns (IERC20) {
        return vaultConfig.tokens[uint256(tokenType)];
    }

    function getTokenTotalShares(
        TokenValidator.Type tokenType
    ) private view returns (uint256) {
        return totalShares[uint256(tokenType)];
    }

    struct VaultConfig {
        IERC20[TOKEN_COUNT] tokens; // Main Tokens (token X and token Y) that the vault will hold
        uint16 binStep; // The bin step for liquidity positions
        uint256[TOKEN_COUNT] amountMins; // Minimum amount of token X to add during rebalance
        address lbRouter; // Address of the LB Router
        address lbpAMM; // Address of the Metro-S AMM LP pair
        address lbpContract; // Address of the LBP contract
    }

    VaultConfig private vaultConfig;
    IArcaFeeManagerV1 private feeManager;
    IArcaQueueHandlerV1 private queueHandler;
    IArcaRewardClaimerV1 public rewardClaimer;

    // Store bin IDs from last add liquidity operation
    uint256[] private lastAddLiquidityBinIds;

    // Share tracking
    uint256[TOKEN_COUNT] private totalShares;
    mapping(address => uint256[TOKEN_COUNT]) private shares;

    // Events
    event SharesMinted(address indexed user, uint256 sharesX, uint256 sharesY);
    event WithdrawProcessed(
        address indexed user,
        uint256 amountX,
        uint256 amountY
    );
    event FeeCollected(
        address indexed recipient,
        uint256 amount,
        string feeType
    );

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

    /**
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

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
        address _lbRouter,
        address _lbpAMM,
        address _lbpContract,
        IArcaRewardClaimerV1 _rewardClaimer,
        IArcaQueueHandlerV1 _queueHandler,
        IArcaFeeManagerV1 _feeManager
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        IERC20[TOKEN_COUNT] memory tokens;
        tokens[uint256(TokenValidator.Type.TokenX)] = IERC20(_tokenX);
        tokens[uint256(TokenValidator.Type.TokenY)] = IERC20(_tokenY);
        uint256[TOKEN_COUNT] memory amountMins;
        amountMins[uint256(TokenValidator.Type.TokenX)] = _amountXMin;
        amountMins[uint256(TokenValidator.Type.TokenY)] = _amountYMin;
        vaultConfig = VaultConfig(
            tokens,
            _binStep,
            amountMins,
            _lbRouter,
            _lbpAMM,
            _lbpContract
        );

        feeManager = _feeManager;
        queueHandler = _queueHandler;
        rewardClaimer = _rewardClaimer;

        // Note: Ownership transfer is handled by VaultDeployer for atomic deployment
        // or manually by deployer for controlled deployment
    }

    /**
     * @dev It calculates the total underlying value of tokenX or tokenY held by the system.
     * It takes into account the vault contract balance excluding queued tokens.
     */
    function tokenBalance(
        TokenValidator.Type tokenType
    ) public view returns (uint256) {
        return
            getVaultToken(tokenType).balanceOf(address(this)) -
            queueHandler.getQueuedToken(tokenType);
    }

    function totalSupply(
        TokenValidator.Type tokenType
    ) public view returns (uint256) {
        return totalShares[uint256(tokenType)];
    }

    /**
     * @dev Function for various UIs to display the current value of one of our yield tokens.
     * Returns an uint256 with 18 decimals of how much underlying asset one vault share represents.
     * This is a simplified implementation that considers only a token type for share value calculation.
     */
    function getPricePerFullShare(
        TokenValidator.Type tokenType
    ) public view returns (uint256) {
        uint256 balance = tokenBalance(tokenType);
        uint256 supply = totalSupply(tokenType);

        if (supply == 0) {
            return 1e18;
        }

        if (balance == 0) {
            return 0; // No underlying assets per share when balance is zero
        }

        return (balance * 1e18) / supply;
    }

    /**
     * @dev A helper function to call depositToken() with all the sender's funds.
     */
    function depositAll(TokenValidator.Type tokenType) external {
        uint256 balance = getVaultToken(tokenType).balanceOf(msg.sender);
        depositToken(balance, tokenType);
    }

    /**
     * @dev Modified deposit function for a token type - now adds to queue instead of immediate minting
     * Tokens are held in contract until next rebalance. Necessary for the rebalance and will help to calculate Shares.
     */
    function depositToken(
        uint256 _amount,
        TokenValidator.Type _tokenType
    ) public nonReentrant {
        require(_amount > 0, "Cannot deposit 0");

        IERC20 token = getVaultToken(_tokenType);
        uint256 _pool = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = token.balanceOf(address(this));
        _amount = _after - _pool;

        // Calculate and collect deposit fee
        uint256 depositFee = (_amount * feeManager.getDepositFee()) /
            feeManager.BASIS_POINTS();
        uint256 netAmount = _amount - depositFee;

        if (depositFee > 0) {
            token.safeTransfer(feeManager.getFeeRecipient(), depositFee);
            emit FeeCollected(
                feeManager.getFeeRecipient(),
                depositFee,
                "deposit"
            );
        }

        // TODO: here, should I use netAmount or _amount?
        queueHandler.enqueueDepositRequest(
            DepositRequest({
                user: msg.sender,
                amount: netAmount,
                tokenType: _tokenType,
                timestamp: block.timestamp
            })
        );
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
    function withdrawTokenShares(
        uint256[2] memory _shares
    ) public nonReentrant {
        require(_shares.length == TOKEN_COUNT, "Invalid token share count");

        uint256 total = 0;

        for (uint256 i = 0; i < TOKEN_COUNT; i++) {
            total += _shares[i];
            require(shares[msg.sender][i] >= _shares[i], "Insufficient shares");
        }

        require(total > 0, "Cannot withdraw 0 shares");

        // Add to withdraw queue
        queueHandler.enqueueWithdrawRequest(
            WithdrawRequest({
                user: msg.sender,
                shares: _shares,
                timestamp: block.timestamp
            })
        );
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
            sharesToWithdraw[i] =
                (_shares * shares[msg.sender][i]) /
                totalUserShares;
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

    /**
     * @dev Updates the rewarder address
     */
    function setRewarder(address _rewarder) external onlyOwner {
        require(_rewarder != address(0), "Invalid rewarder address");
        rewardClaimer.setRewarder(_rewarder);
    }

    function rebalance(
        RebalanceParams calldata params
    )
        external
        onlyOwner
        nonReentrant
        returns (
            uint256 amountXAdded,
            uint256 amountYAdded,
            uint256 amountXRemoved,
            uint256 amountYRemoved
        )
    {
        require(block.timestamp <= params.deadline, "Transaction expired");

        // Remove liquidity if needed
        if (
            (params.forceRebalance || params.ids.length > 0) &&
            params.amounts.length > 0
        ) {
            require(
                params.ids.length == params.amounts.length,
                "Array lengths must match"
            );

            (amountXRemoved, amountYRemoved) = ILBRouter(vaultConfig.lbRouter)
                .removeLiquidity(
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
        rewardClaimer.claimAndCompoundRewards();

        // Step 3: Process withdraw queue FIRST (before calculating deposit shares)
        uint256[TOKEN_COUNT] memory totalRemoved = [
            amountXRemoved,
            amountYRemoved
        ];
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

            ILBRouter.LiquidityParameters memory liquidityParams = ILBRouter
                .LiquidityParameters({
                    tokenX: _tokenX,
                    tokenY: _tokenY,
                    binStep: vaultConfig.binStep,
                    amountX: availableTokenX,
                    amountY: availableTokenY,
                    amountXMin: vaultConfig.amountMins[
                        uint256(TokenValidator.Type.TokenX)
                    ],
                    amountYMin: vaultConfig.amountMins[
                        uint256(TokenValidator.Type.TokenY)
                    ],
                    activeIdDesired: ILBPair(vaultConfig.lbpContract)
                        .getActiveId(),
                    idSlippage: rewardClaimer.idSlippage(),
                    deltaIds: params.deltaIds,
                    distributionX: params.distributionX,
                    distributionY: params.distributionY,
                    to: params.to,
                    refundTo: params.refundTo,
                    deadline: params.deadline
                });

            (amountXAdded, amountYAdded, , , , ) = ILBRouter(
                vaultConfig.lbRouter
            ).addLiquidity(liquidityParams);
        }

        emit Rebalanced(
            address(_tokenX),
            address(_tokenY),
            amountXAdded,
            amountYAdded,
            amountXRemoved,
            amountYRemoved,
            depositsProcessed,
            withdrawsProcessed
        );

        return (amountXAdded, amountYAdded, amountXRemoved, amountYRemoved);
    }

    /**
     * @dev Internal function to process withdraw queue
     * Calculates each user's share of withdrawn tokens and processes their withdrawal
     */
    function _processWithdrawQueue(
        uint256[2] memory totalRemoved
    ) private returns (uint256 processed) {
        require(totalRemoved.length == TOKEN_COUNT, "Invalid array length");
        WithdrawRequest[] memory withdrawRequests = queueHandler
            .getWithdrawQueueTrailingSlice();

        for (uint256 i = 0; i < withdrawRequests.length; i++) {
            WithdrawRequest memory request = withdrawRequests[i];

            // Calculate user's share of withdrawn tokens
            uint256[TOKEN_COUNT] memory userAmounts;

            uint256 totalWithdrawAmount = 0;

            for (uint256 tokenIdx = 0; tokenIdx < TOKEN_COUNT; tokenIdx++) {
                // Sanity check: user shouldn't have shares if total shares is zero
                require(
                    totalShares[tokenIdx] > 0 || request.shares[tokenIdx] == 0,
                    "Invalid state: user has shares but total shares is zero"
                );

                // Skip calculation if no total shares (should not happen due to sanity check above)
                if (totalShares[tokenIdx] == 0) {
                    userAmounts[tokenIdx] = 0;
                    continue;
                }

                // Share of removed liquidity
                userAmounts[tokenIdx] =
                    (totalRemoved[tokenIdx] * request.shares[tokenIdx]) /
                    totalShares[tokenIdx];

                uint256 existing = tokenBalance(TokenValidator.Type(tokenIdx));

                if (existing > 0) {
                    userAmounts[tokenIdx] +=
                        (existing * request.shares[tokenIdx]) /
                        totalShares[tokenIdx];
                }

                totalWithdrawAmount += userAmounts[tokenIdx];
            }

            // Calculate withdraw fee on total withdrawal amount
            uint256 withdrawFee = (totalWithdrawAmount *
                feeManager.getWithdrawFee()) / feeManager.BASIS_POINTS();

            // Apply fee proportionally to both tokens
            if (withdrawFee > 0 && totalWithdrawAmount > 0) {
                for (uint256 tokenIdx = 0; tokenIdx < TOKEN_COUNT; tokenIdx++) {
                    uint256 fee = (userAmounts[tokenIdx] * withdrawFee) /
                        totalWithdrawAmount;
                    userAmounts[tokenIdx] -= fee;

                    // Send fees to fee recipient
                    if (fee > 0) {
                        IERC20 token = getVaultToken(
                            TokenValidator.Type(tokenIdx)
                        );
                        token.safeTransfer(feeManager.getFeeRecipient(), fee);
                    }
                }

                emit FeeCollected(
                    feeManager.getFeeRecipient(),
                    withdrawFee,
                    "withdraw"
                );
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

            emit WithdrawProcessed(
                request.user,
                userAmounts[uint256(TokenValidator.Type.TokenX)],
                userAmounts[uint256(TokenValidator.Type.TokenY)]
            );
            processed++;
        }

        return processed;
    }

    /**
     * @dev Internal function to process deposit queue
     * Mints shares based on current token balances after withdrawals are processed and rewards compounded
     */
    function _processDepositQueue() private returns (uint256 processed) {
        DepositRequest[] memory depositRequests = queueHandler
            .getDepositQueueTrailingSlice();

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
                    newShares =
                        (request.amount * totalShares[tokenIdx]) /
                        currentBalance;
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
            emit SharesMinted(
                request.user,
                isTokenX ? newShares : 0,
                isTokenX ? 0 : newShares
            );
            processed++;
        }

        return processed;
    }

    /**
     * @dev Set swap paths for METRO rewards
     */
    function setSwapPaths(
        ILBRouter.Path calldata _metroToTokenXPath,
        ILBRouter.Path calldata _metroToTokenYPath,
        ILBRouter.Path calldata _metroToNativePath
    ) external onlyOwner {
        rewardClaimer.setSwapPaths(
            _metroToTokenXPath,
            _metroToTokenYPath,
            _metroToNativePath
        );
    }

    /**
     * @dev Set minimum swap amount
     */
    function setMinSwapAmount(uint256 _minSwapAmount) external onlyOwner {
        rewardClaimer.setMinSwapAmount(_minSwapAmount);
    }

    /**
     * @dev Rescues random funds stuck that the contract can't handle.
     */
    function inCaseTokensGetStuck(
        address _token
    ) external onlyOwner nonReentrant {
        require(
            _token != address(getVaultToken(TokenValidator.Type.TokenX)) &&
                _token != address(getVaultToken(TokenValidator.Type.TokenY)),
            "Unknown token type"
        );
        uint256 amount = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(msg.sender, amount);
    }

    /**
     * @dev Get user's total shares (for backwards compatibility)
     */
    function balanceSharesCombined(
        address account
    ) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < TOKEN_COUNT; i++) {
            total += shares[account][i];
        }

        return total;
    }

    /**
     * @dev Get user's shares for a specific token type (replaces ERC20 balanceOf)
     */
    function getShares(
        address user,
        TokenValidator.Type tokenType
    ) external view returns (uint256) {
        return shares[user][uint256(tokenType)];
    }

    /**
     * @dev Get user's share breakdown
     */
    function getUserShares(
        address user
    ) external view returns (uint256 userSharesX, uint256 userSharesY) {
        return (
            shares[user][uint256(TokenValidator.Type.TokenX)],
            shares[user][uint256(TokenValidator.Type.TokenY)]
        );
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract.
     * Called by {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * @dev Storage gap for future upgrades
     * This gap allows us to add new storage variables in future versions
     * Current storage slots used: ~15 (estimated)
     * Gap size: 50 - 15 = 35 slots reserved
     */
    uint256[35] private __gap;
}

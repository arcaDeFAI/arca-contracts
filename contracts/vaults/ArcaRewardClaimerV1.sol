// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ILBRouter} from "../../lib/joe-v2/src/interfaces/ILBRouter.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ILBPair} from "../../lib/joe-v2/src/interfaces/ILBPair.sol";
import {
    ILBHooksBaseRewarder
} from "../interfaces/Metropolis/ILBHooksBaseRewarder.sol";
import {IPair} from "../interfaces/Metropolis/IPair.sol"; // AMM V2  Pools
import {IArcaFeeManagerV1} from "../interfaces/IArcaFeeManagerV1.sol";
import {TokenValidator} from "../TokenTypes.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IArcaRewardClaimerV1} from "../interfaces/IArcaRewardClaimerV1.sol";

contract ArcaRewardClaimerV1 is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    TokenValidator,
    IArcaRewardClaimerV1
{
    using SafeERC20 for IERC20;
    address private _rewarder;
    address private _rewardToken;
    IArcaFeeManagerV1 private _feeManager;
    uint256 public minSwapAmount; // Minimum amounts for swapping (to avoid dust)
    IERC20[TOKEN_COUNT] private tokens; // Main Tokens (token X and token Y) that the vault will hold

    // Native token address (WAVAX or similar)
    address public nativeToken;

    // Swap paths for METRO -> tokenX and METRO -> tokenY
    ILBRouter.Path[TOKEN_COUNT] private metroToTokenPaths;
    ILBRouter.Path private metroToNativePath;

    // Compounding tracking for analytics
    uint256[TOKEN_COUNT] private totalCompounded; // Total compounded from rewards per token (global analytics)

    address private _lbpContract;
    address private _lbpContractUSD; //To fetch the value of USDC/USDT via their DLMM pool
    address private _lpAMM; // To fetch the value of Metro/USD and Metro/S
    address private _lbRouter;
    uint256 public idSlippage; // The number of bins to slip

    /**
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the reward claimer
     */
    function initialize(
        address rewarder,
        address rewardToken,
        IArcaFeeManagerV1 feeManager,
        address _nativeToken,
        address lbpContract,
        address lpAMM,
        address lbpContractUSD,
        address lbRouter,
        uint256 _idSlippage,
        address tokenX,
        address tokenY
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _rewarder = rewarder;
        _rewardToken = rewardToken;
        _feeManager = feeManager;
        nativeToken = _nativeToken;
        _lbpContract = lbpContract;
        _lpAMM = lpAMM;
        _lbpContractUSD = lbpContractUSD;
        _lbRouter = lbRouter;
        idSlippage = _idSlippage;
        minSwapAmount = 10; // 0.001 METRO minimum
        tokens[uint256(TokenValidator.Type.TokenX)] = IERC20(tokenX);
        tokens[uint256(TokenValidator.Type.TokenY)] = IERC20(tokenY);
    }

    // Events
    event FeeCollected(
        address indexed recipient,
        uint256 amount,
        string feeType
    );
    event RewardsClaimed(address rewarder, address token, uint256 amount);

    event RewardsCompounded(
        uint256 metroAmount,
        uint256 tokenXCompounded,
        uint256 tokenYCompounded
    );

    /**
     * @dev Get total amount compounded from rewards for analytics
     */
    function getTotalCompounded(
        TokenValidator.Type tokenType
    ) external view returns (uint256) {
        return totalCompounded[uint256(tokenType)];
    }

    function setMinSwapAmount(uint256 _minSwapAmount) external onlyOwner {
        minSwapAmount = _minSwapAmount;
    }

    function getVaultToken(
        TokenValidator.Type tokenType
    ) private view returns (IERC20) {
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
        require(rewarder != address(0), "Invalid rewarder address");
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

        uint256 metroBalanceBefore = IERC20(_rewardToken).balanceOf(
            address(this)
        );

        // Claim METRO rewards
        try ILBHooksBaseRewarder(_rewarder).claim(address(this), binIds) {
            uint256 metroBalanceAfter = IERC20(_rewardToken).balanceOf(
                address(this)
            );
            uint256 metroClaimed = metroBalanceAfter - metroBalanceBefore;

            if (metroClaimed > 0) {
                // Calculate performance fee on claimed rewards (always collected for consistency)
                uint256 performanceFee = (metroClaimed *
                    _feeManager.getPerformanceFee()) /
                    _feeManager.BASIS_POINTS();
                uint256 netMetro = metroClaimed - performanceFee;

                // Send performance fee to fee recipient
                if (performanceFee > 0) {
                    IERC20(_rewardToken).safeTransfer(
                        _feeManager.getFeeRecipient(),
                        performanceFee
                    );
                    emit FeeCollected(
                        _feeManager.getFeeRecipient(),
                        performanceFee,
                        "performance"
                    );
                }

                // Only swap if net metro is above minimum swap amount
                if (netMetro > minSwapAmount) {
                    // Compound the remaining rewards
                    uint256 metroForTokenX = netMetro / 2;
                    uint256 metroForTokenY = netMetro - metroForTokenX;

                    uint256[TOKEN_COUNT] memory metroForTokens = [
                        metroForTokenX,
                        metroForTokenY
                    ];
                    uint256[TOKEN_COUNT] memory tokenObtained;

                    for (uint256 i = 0; i < TOKEN_COUNT; i++) {
                        tokenObtained[i] = 0;

                        // Swap METRO to token
                        if (metroForTokens[i] > 0) {
                            tokenObtained[i] = _swapMetroToToken(
                                metroForTokens[i],
                                address(getVaultToken(TokenValidator.Type(i))),
                                metroToTokenPaths[i]
                            );
                        }

                        // Update global analytics counter
                        totalCompounded[i] += tokenObtained[i];
                    }

                    emit RewardsCompounded(
                        metroClaimed,
                        tokenObtained[uint256(TokenValidator.Type.TokenX)],
                        tokenObtained[uint256(TokenValidator.Type.TokenY)]
                    );
                }

                emit RewardsClaimed(_rewarder, _rewardToken, metroClaimed);
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
    )
        public
        view
        returns (uint256 expectedOutput, uint256 minimumExpectedOutput)
    {
        ILBPair routerPair = ILBPair(_lbpContract);
        IPair routerAMM = IPair(_lpAMM);

        uint256 decimals;
        uint256 metroDecimals = 18; // Assuming METRO has 18 decimals

        bool isTokenXY = targetToken ==
            address(getVaultToken(TokenValidator.Type.TokenX)) ||
            targetToken == address(getVaultToken(TokenValidator.Type.TokenY));

        // Set decimals based on target token
        if (isTokenXY) {
            decimals = 18; // S token decimals
        } else {
            decimals = 6; // USDC decimals
        }

        // DLMM Pool - Get current active bin ID and price for tokenX (S)
        uint24 activeID = routerPair.getActiveId();
        uint256 rawPrice = routerPair.getPriceFromId(activeID);

        // TODO: What do we do with "realPrice"?
        // AMM V2 Pool - Get Reserve0 (S) and Reserve1 (metro) from the LP AMM V2 pool contract function getReserves
        // uint256 reserve0;
        // uint256 reserve1;
        // (reserve0, reserve0, ) = routerAMM.getReserves();

        // // Convert 128.128 fixed-point price to human readable
        uint256 scale = 2 ** 128;
        // uint hReadable = 10 ** 12;
        // uint256 realPrice = (rawPrice / scale) * hReadable; // Real tokenX (S) price in USDC value. ex: 0.3314 USDC / S
        uint256 pricePerUnit;

        if (isTokenXY) {
            // Calculate METRO price in S tokens
            // rawPrice represents price of tokenY/tokenX, we need METRO/S
            // Since METRO is being swapped for S, we need the appropriate conversion
            pricePerUnit =
                (rawPrice * (10 ** decimals)) /
                (scale * (10 ** (metroDecimals - decimals)));
        } else {
            // Calculate METRO price in USDC
            // For USDC, we can use the inverse since 1 USDC = 1 USD
            pricePerUnit =
                (scale * (10 ** decimals)) /
                (rawPrice * (10 ** (metroDecimals - decimals)));
        }

        // Calculate expected output before slippage
        expectedOutput = (metroAmount * pricePerUnit) / (10 ** metroDecimals);

        // Apply slippage protection (e.g., 0.5% slippage tolerance)
        uint256 slippageBasisPoints = 50; // 0.5% = 50 basis points
        uint256 slippageFactor = 10000 - slippageBasisPoints; // 9950

        // Calculate minimal expected output with slippage protection
        minimumExpectedOutput = (expectedOutput * slippageFactor) / 10000;

        return (expectedOutput, minimumExpectedOutput);
    }

    /**
     * @dev Swaps METRO to target token using the appropriate path
     * Sends swapped tokens directly to the main vault (owner) for proper share value calculation
     */
    function _swapMetroToToken(
        uint256 metroAmount,
        address targetToken,
        ILBRouter.Path memory swapPath
    ) private returns (uint256 amountOut) {
        if (metroAmount == 0 || swapPath.tokenPath.length == 0) return 0;

        IERC20(_rewardToken).approve(_lbRouter, 0);
        IERC20(_rewardToken).approve(_lbRouter, metroAmount);

        // Main vault is the owner - tokens go there for automatic share value increase
        address vaultAddress = owner();
        uint256 balanceBefore = IERC20(targetToken).balanceOf(vaultAddress);

        // Get expected output from price oracle
        (, uint256 minAmountOut) = getExpectedSwapOutput(
            metroAmount,
            targetToken
        );

        try
            ILBRouter(_lbRouter).swapExactTokensForTokens(
                metroAmount,
                minAmountOut, // Proper slippage protection
                swapPath,
                vaultAddress, // Send directly to main vault
                block.timestamp + 300
            )
        returns (uint256) {
            uint256 balanceAfter = IERC20(targetToken).balanceOf(vaultAddress);
            amountOut = balanceAfter - balanceBefore;
        } catch {
            // Swap failed, try native swap if target is not native
            if (
                targetToken != nativeToken &&
                metroToNativePath.tokenPath.length > 0
            ) {
                try
                    ILBRouter(_lbRouter).swapExactTokensForNATIVE(
                        metroAmount,
                        0,
                        metroToNativePath,
                        payable(vaultAddress), // Send to main vault
                        block.timestamp + 300
                    )
                {
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

        // Claim rewards to this contract first
        ILBHooksBaseRewarder(_rewarder).claim(address(this), binIds);

        // Calculate how much was actually claimed
        uint256 balanceAfter = IERC20(_rewardToken).balanceOf(address(this));
        claimedAmount = balanceAfter - balanceBefore;

        // Transfer claimed amount to the specified receiver
        if (claimedAmount > 0) {
            IERC20(_rewardToken).transfer(receiver, claimedAmount);
        }

        emit RewardsClaimed(_rewarder, _rewardToken, claimedAmount);

        return claimedAmount;
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
     * Current storage slots used: ~20 (estimated)
     * Gap size: 50 - 20 = 30 slots reserved
     */
    uint256[30] private __gap;
}

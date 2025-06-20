// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ArcaTestnetV1} from "../vaults/ArcaTestnetV1.sol";
import {ArcaRewardClaimerV1} from "../vaults/ArcaRewardClaimerV1.sol";
import {ArcaQueueHandlerV1} from "../vaults/ArcaQueueHandlerV1.sol";
import {ArcaFeeManagerV1} from "../ArcaFeeManagerV1.sol";
import {IArcaRewardClaimerV1} from "../interfaces/IArcaRewardClaimerV1.sol";
import {IArcaQueueHandlerV1} from "../interfaces/IArcaQueueHandlerV1.sol";
import {IArcaFeeManagerV1} from "../interfaces/IArcaFeeManagerV1.sol";

/**
 * @title ArcaVaultFactory
 * @dev Factory contract for deploying Arca vault systems with sequential deployment
 * Solves stack-too-deep issues by breaking deployment into discrete steps
 * Supports both direct deployment and future proxy deployment patterns
 */
contract ArcaVaultFactory is Ownable {
    // Events for tracking deployment progress
    event ComponentDeployed(
        string indexed component,
        address indexed contractAddress
    );
    event VaultSystemCompleted(
        address indexed vault,
        uint256 indexed deploymentId
    );
    event DeploymentStarted(
        uint256 indexed deploymentId,
        address indexed deployer
    );

    // Deployment tracking
    uint256 public nextDeploymentId;

    // Current deployment state (reset after each deployment)
    struct DeploymentState {
        address feeManager;
        address queueHandler;
        address rewardClaimer;
        address vault;
        bool isActive;
        address deployer;
    }

    mapping(uint256 => DeploymentState) public deployments;
    uint256 private currentDeploymentId;

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Start a new vault system deployment
     * Returns deployment ID for tracking
     */
    function startDeployment()
        external
        onlyOwner
        returns (uint256 deploymentId)
    {
        deploymentId = nextDeploymentId++;
        currentDeploymentId = deploymentId;

        deployments[deploymentId] = DeploymentState({
            feeManager: address(0),
            queueHandler: address(0),
            rewardClaimer: address(0),
            vault: address(0),
            isActive: true,
            deployer: msg.sender
        });

        emit DeploymentStarted(deploymentId, msg.sender);
        return deploymentId;
    }

    /**
     * @dev Step 1: Deploy fee manager
     */
    function deployFeeManager(address feeRecipient) external onlyOwner {
        require(
            deployments[currentDeploymentId].isActive,
            "No active deployment"
        );
        require(
            deployments[currentDeploymentId].feeManager == address(0),
            "Fee manager already deployed"
        );

        ArcaFeeManagerV1 feeManager = new ArcaFeeManagerV1();
        feeManager.initialize(feeRecipient);
        deployments[currentDeploymentId].feeManager = address(feeManager);

        emit ComponentDeployed("FeeManager", address(feeManager));
    }

    /**
     * @dev Step 2: Deploy queue handler
     */
    function deployQueueHandler() external onlyOwner {
        require(
            deployments[currentDeploymentId].isActive,
            "No active deployment"
        );
        require(
            deployments[currentDeploymentId].queueHandler == address(0),
            "Queue handler already deployed"
        );

        ArcaQueueHandlerV1 queueHandler = new ArcaQueueHandlerV1();
        queueHandler.initialize();
        deployments[currentDeploymentId].queueHandler = address(queueHandler);

        emit ComponentDeployed("QueueHandler", address(queueHandler));
    }

    /**
     * @dev Step 3: Deploy reward claimer
     */
    function deployRewardClaimer(
        address rewarder,
        address rewardToken,
        address nativeToken,
        address lbpContract,
        address lpAMM,
        address lbpContractUSD,
        address lbRouter,
        uint256 idSlippage,
        address tokenX,
        address tokenY
    ) external onlyOwner {
        require(
            deployments[currentDeploymentId].isActive,
            "No active deployment"
        );
        require(
            deployments[currentDeploymentId].rewardClaimer == address(0),
            "Reward claimer already deployed"
        );
        require(
            deployments[currentDeploymentId].feeManager != address(0),
            "Fee manager not deployed"
        );

        ArcaRewardClaimerV1 rewardClaimer = new ArcaRewardClaimerV1();
        rewardClaimer.initialize(
            rewarder,
            rewardToken,
            IArcaFeeManagerV1(deployments[currentDeploymentId].feeManager),
            nativeToken,
            lbpContract,
            lpAMM,
            lbpContractUSD,
            lbRouter,
            idSlippage,
            tokenX,
            tokenY
        );

        deployments[currentDeploymentId].rewardClaimer = address(rewardClaimer);

        emit ComponentDeployed("RewardClaimer", address(rewardClaimer));
    }

    /**
     * @dev Step 4: Deploy and initialize vault
     */
    function deployVault(
        address tokenX,
        address tokenY,
        uint16 binStep,
        uint256 amountXMin,
        uint256 amountYMin,
        string memory name,
        string memory symbol,
        address lbRouter,
        address lbpAMM,
        address lbpContract
    ) external onlyOwner {
        require(
            deployments[currentDeploymentId].isActive,
            "No active deployment"
        );
        require(
            deployments[currentDeploymentId].vault == address(0),
            "Vault already deployed"
        );
        require(
            deployments[currentDeploymentId].feeManager != address(0),
            "Fee manager not deployed"
        );
        require(
            deployments[currentDeploymentId].queueHandler != address(0),
            "Queue handler not deployed"
        );
        require(
            deployments[currentDeploymentId].rewardClaimer != address(0),
            "Reward claimer not deployed"
        );

        // Deploy vault
        ArcaTestnetV1 vault = new ArcaTestnetV1();

        // Initialize vault
        vault.initialize(
            tokenX,
            tokenY,
            binStep,
            amountXMin,
            amountYMin,
            name,
            symbol,
            lbRouter,
            lbpAMM,
            lbpContract,
            IArcaRewardClaimerV1(
                deployments[currentDeploymentId].rewardClaimer
            ),
            IArcaQueueHandlerV1(deployments[currentDeploymentId].queueHandler),
            IArcaFeeManagerV1(deployments[currentDeploymentId].feeManager)
        );

        deployments[currentDeploymentId].vault = address(vault);

        emit ComponentDeployed("Vault", address(vault));
    }

    /**
     * @dev Step 5: Complete deployment by transferring ownership
     */
    function completeDeployment() external onlyOwner {
        require(
            deployments[currentDeploymentId].isActive,
            "No active deployment"
        );
        DeploymentState storage deployment = deployments[currentDeploymentId];

        require(deployment.vault != address(0), "Vault not deployed");
        require(
            deployment.feeManager != address(0),
            "Fee manager not deployed"
        );
        require(
            deployment.queueHandler != address(0),
            "Queue handler not deployed"
        );
        require(
            deployment.rewardClaimer != address(0),
            "Reward claimer not deployed"
        );

        // Transfer ownership of all components to vault
        ArcaRewardClaimerV1(deployment.rewardClaimer).transferOwnership(
            deployment.vault
        );
        ArcaQueueHandlerV1(deployment.queueHandler).transferOwnership(
            deployment.vault
        );
        ArcaFeeManagerV1(deployment.feeManager).transferOwnership(
            deployment.vault
        );

        // Verify ownership transfers
        require(
            ArcaRewardClaimerV1(deployment.rewardClaimer).owner() ==
                deployment.vault,
            "RewardClaimer ownership transfer failed"
        );
        require(
            ArcaQueueHandlerV1(deployment.queueHandler).owner() ==
                deployment.vault,
            "QueueHandler ownership transfer failed"
        );
        require(
            ArcaFeeManagerV1(deployment.feeManager).owner() == deployment.vault,
            "FeeManager ownership transfer failed"
        );

        // Mark deployment as complete
        deployment.isActive = false;

        emit VaultSystemCompleted(deployment.vault, currentDeploymentId);
    }

    /**
     * @dev Get deployment status
     */
    function getDeploymentStatus(
        uint256 deploymentId
    ) external view returns (DeploymentState memory) {
        return deployments[deploymentId];
    }

    /**
     * @dev Emergency function to cancel current deployment
     */
    function cancelDeployment() external onlyOwner {
        require(
            deployments[currentDeploymentId].isActive,
            "No active deployment"
        );
        deployments[currentDeploymentId].isActive = false;
    }
}

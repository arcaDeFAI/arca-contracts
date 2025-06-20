// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ArcaVaultRegistry
 * @dev Registry contract for tracking deployed Arca vault instances
 * Provides discovery and management capabilities for the vault ecosystem
 * Supports both direct and proxy-deployed vaults
 */
contract ArcaVaultRegistry is Ownable {
    struct VaultInfo {
        address vault;
        address rewardClaimer;
        address queueHandler;
        address feeManager;
        address tokenX;
        address tokenY;
        string name;
        string symbol;
        uint256 deploymentTimestamp;
        address deployer;
        bool isActive;
        bool isProxy; // For future proxy deployment support
    }

    // Registry storage
    mapping(address => VaultInfo) public vaultInfo;
    address[] public vaultList;
    mapping(address => bool) public isRegisteredVault;

    // Token pair tracking
    mapping(bytes32 => address[]) public vaultsByTokenPair;

    // Events
    event VaultRegistered(
        address indexed vault,
        address indexed tokenX,
        address indexed tokenY,
        string name,
        uint256 deploymentId
    );

    event VaultDeactivated(address indexed vault, string reason);
    event VaultActivated(address indexed vault);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Register a newly deployed vault system
     */
    function registerVault(
        address vault,
        address rewardClaimer,
        address queueHandler,
        address feeManager,
        address tokenX,
        address tokenY,
        string memory name,
        string memory symbol,
        uint256 deploymentId,
        bool isProxy
    ) external onlyOwner {
        require(vault != address(0), "Invalid vault address");
        require(!isRegisteredVault[vault], "Vault already registered");

        // Create vault info
        VaultInfo storage info = vaultInfo[vault];
        info.vault = vault;
        info.rewardClaimer = rewardClaimer;
        info.queueHandler = queueHandler;
        info.feeManager = feeManager;
        info.tokenX = tokenX;
        info.tokenY = tokenY;
        info.name = name;
        info.symbol = symbol;
        info.deploymentTimestamp = block.timestamp;
        info.deployer = msg.sender;
        info.isActive = true;
        info.isProxy = isProxy;

        // Add to tracking
        vaultList.push(vault);
        isRegisteredVault[vault] = true;

        // Track by token pair
        bytes32 pairHash = keccak256(abi.encodePacked(tokenX, tokenY));
        vaultsByTokenPair[pairHash].push(vault);

        emit VaultRegistered(vault, tokenX, tokenY, name, deploymentId);
    }

    /**
     * @dev Deactivate a vault (for emergencies or upgrades)
     */
    function deactivateVault(
        address vault,
        string memory reason
    ) external onlyOwner {
        require(isRegisteredVault[vault], "Vault not registered");
        require(vaultInfo[vault].isActive, "Vault already inactive");

        vaultInfo[vault].isActive = false;
        emit VaultDeactivated(vault, reason);
    }

    /**
     * @dev Reactivate a vault
     */
    function activateVault(address vault) external onlyOwner {
        require(isRegisteredVault[vault], "Vault not registered");
        require(!vaultInfo[vault].isActive, "Vault already active");

        vaultInfo[vault].isActive = true;
        emit VaultActivated(vault);
    }

    /**
     * @dev Get all vaults for a token pair
     */
    function getVaultsByTokenPair(
        address tokenX,
        address tokenY
    ) external view returns (address[] memory) {
        bytes32 pairHash = keccak256(abi.encodePacked(tokenX, tokenY));
        return vaultsByTokenPair[pairHash];
    }

    /**
     * @dev Get all active vaults
     */
    function getActiveVaults() external view returns (address[] memory) {
        uint256 activeCount = 0;

        // Count active vaults
        for (uint256 i = 0; i < vaultList.length; i++) {
            if (vaultInfo[vaultList[i]].isActive) {
                activeCount++;
            }
        }

        // Create active vaults array
        address[] memory activeVaults = new address[](activeCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < vaultList.length; i++) {
            if (vaultInfo[vaultList[i]].isActive) {
                activeVaults[currentIndex] = vaultList[i];
                currentIndex++;
            }
        }

        return activeVaults;
    }

    /**
     * @dev Get total number of vaults
     */
    function getVaultCount() external view returns (uint256) {
        return vaultList.length;
    }

    /**
     * @dev Get vault info by address
     */
    function getVaultInfo(
        address vault
    ) external view returns (VaultInfo memory) {
        require(isRegisteredVault[vault], "Vault not registered");
        return vaultInfo[vault];
    }

    /**
     * @dev Get basic vault details
     */
    function getVaultDetails(
        address vault
    )
        external
        view
        returns (
            string memory name,
            string memory symbol,
            address tokenX,
            address tokenY,
            bool isActive,
            bool isProxy
        )
    {
        require(isRegisteredVault[vault], "Vault not registered");
        VaultInfo storage info = vaultInfo[vault];

        return (
            info.name,
            info.symbol,
            info.tokenX,
            info.tokenY,
            info.isActive,
            info.isProxy
        );
    }

    /**
     * @dev Get vault components
     */
    function getVaultComponents(
        address vault
    )
        external
        view
        returns (
            address rewardClaimer,
            address queueHandler,
            address feeManager
        )
    {
        require(isRegisteredVault[vault], "Vault not registered");
        VaultInfo storage info = vaultInfo[vault];

        return (info.rewardClaimer, info.queueHandler, info.feeManager);
    }

    /**
     * @dev Check if vault is active and registered
     */
    function isActiveVault(address vault) external view returns (bool) {
        return isRegisteredVault[vault] && vaultInfo[vault].isActive;
    }

    /**
     * @dev Get deployment info
     */
    function getDeploymentInfo(
        address vault
    ) external view returns (uint256 deploymentTimestamp, address deployer) {
        require(isRegisteredVault[vault], "Vault not registered");
        VaultInfo storage info = vaultInfo[vault];

        return (info.deploymentTimestamp, info.deployer);
    }
}

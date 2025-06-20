// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IArcaFeeManagerV1} from "./interfaces/IArcaFeeManagerV1.sol";
import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ArcaFeeManagerV1 is
    Initializable,
    OwnableUpgradeable,
    IArcaFeeManagerV1
{
    uint256 private depositFee; // 0.5% (50 basis points) - set in initializer
    uint256 private withdrawFee; // 0.5% (50 basis points) - set in initializer
    uint256 private performanceFee; // 10% (1000 basis points) - set in initializer
    address private feeRecipient;

    uint256 public constant BASIS_POINTS = 10000;

    event FeesUpdated(
        uint256 depositFee,
        uint256 withdrawFee,
        uint256 performanceFee
    );
    event FeeRecipientUpdated(address newRecipient);

    /**
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the fee manager
     */
    function initialize(address _feeRecipient) public initializer {
        __Ownable_init(msg.sender);
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        
        // Set default fee values
        depositFee = 50;    // 0.5%
        withdrawFee = 50;   // 0.5%
        performanceFee = 1000; // 10%
    }

    function setFees(
        uint256 _depositFee,
        uint256 _withdrawFee,
        uint256 _performanceFee
    ) external onlyOwner {
        require(_depositFee <= 500, "Deposit fee too high"); // Max 5%
        require(_withdrawFee <= 500, "Withdraw fee too high"); // Max 5%
        require(_performanceFee <= 2000, "Performance fee too high"); // Max 20%

        depositFee = _depositFee;
        withdrawFee = _withdrawFee;
        performanceFee = _performanceFee;

        emit FeesUpdated(_depositFee, _withdrawFee, _performanceFee);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    function getDepositFee() external view override returns (uint256) {
        return depositFee;
    }

    function getWithdrawFee() external view override returns (uint256) {
        return withdrawFee;
    }

    function getPerformanceFee() external view override returns (uint256) {
        return performanceFee;
    }

    function getFeeRecipient() external view override returns (address) {
        return feeRecipient;
    }

    /**
     * @dev Storage gap for future upgrades
     * This gap allows us to add new storage variables in future versions
     * Current storage slots used: ~5 (estimated)
     * Gap size: 50 - 5 = 45 slots reserved
     */
    uint256[45] private __gap;
}

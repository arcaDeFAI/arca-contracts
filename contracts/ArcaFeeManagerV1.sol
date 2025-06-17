// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IArcaFeeManagerV1} from "./interfaces/IArcaFeeManagerV1.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ArcaFeeManagerV1 is Ownable, IArcaFeeManagerV1 {
    uint256 private depositFee = 50; // 0.5% (50 basis points)
    uint256 private withdrawFee = 50; // 0.5% (50 basis points)
    uint256 private performanceFee = 1000; // 10% (1000 basis points)
    address private feeRecipient;

    uint256 public constant BASIS_POINTS = 10000;

    event FeesUpdated(
        uint256 depositFee,
        uint256 withdrawFee,
        uint256 performanceFee
    );
    event FeeRecipientUpdated(address newRecipient);

    constructor(address _feeRecipient) Ownable(msg.sender) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
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
}

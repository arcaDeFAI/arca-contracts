// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.26;

interface IFeeDistributorFactory {
    function createFeeDistributor(address pairFees) external returns (address);
}

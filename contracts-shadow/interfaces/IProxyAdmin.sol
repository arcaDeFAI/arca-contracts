// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IProxyAdmin {
    function upgrade(address proxy, address implementation) external;

    function getProxyImplementation(address) external view returns (address);
}

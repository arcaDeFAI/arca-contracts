// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const arcaVaultModule = buildModule("ArcaVaultModule", (m) => {
  const arcaVaultContract = m.contract("ArcaTestnetV1");
  return { arcaVaultContract };
});


export default arcaVaultModule;

import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer"
import "hardhat-interface-generator";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
    viaIR: true,
    optimizer: {
      enabled: true,
      details: {
        yulDetails: {
          optimizerSteps: "u",
        },
      },
    },
  }},
  paths: {
    sources: "./contracts",
  },
};

export default config;

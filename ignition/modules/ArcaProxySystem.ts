import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Advanced Ignition module for UUPS proxy deployment
// Note: This module is planned for future use when Hardhat Ignition
// fully supports OpenZeppelin proxy patterns. Currently use scripts for UUPS deployment.

const arcaProxySystemModule = buildModule("ArcaProxySystemModule", (m) => {
  // Parameters with defaults for testing
  const feeRecipient = m.getParameter("feeRecipient", "0x1234567890123456789012345678901234567890");
  const tokenX = m.getParameter("tokenX", "0x1234567890123456789012345678901234567890");
  const tokenY = m.getParameter("tokenY", "0x0987654321098765432109876543210987654321");
  const binStep = m.getParameter("binStep", 100);
  const amountXMin = m.getParameter("amountXMin", 1000n);
  const amountYMin = m.getParameter("amountYMin", 1000n);
  const name = m.getParameter("name", "Arca Test Vault");
  const symbol = m.getParameter("symbol", "ARCA-TEST");
  const lbRouter = m.getParameter("lbRouter", "0x7777777777777777777777777777777777777777");
  const lbpAMM = m.getParameter("lbpAMM", "0x5555555555555555555555555555555555555555");
  const lbpContract = m.getParameter("lbpContract", "0x4444444444444444444444444444444444444444");
  const rewarder = m.getParameter("rewarder", "0x1111111111111111111111111111111111111111");
  const rewardToken = m.getParameter("rewardToken", "0x2222222222222222222222222222222222222222");
  const nativeToken = m.getParameter("nativeToken", "0x3333333333333333333333333333333333333333");
  const lbpContractUSD = m.getParameter("lbpContractUSD", "0x6666666666666666666666666666666666666666");
  const idSlippage = m.getParameter("idSlippage", 100n);

  // Step 1: Deploy implementation contracts first (required for proxy deployment)
  const queueHandlerImpl = m.contract("ArcaQueueHandlerV1");
  const feeManagerImpl = m.contract("ArcaFeeManagerV1");
  const rewardClaimerImpl = m.contract("ArcaRewardClaimerV1");
  const vaultImpl = m.contract("ArcaTestnetV1");

  // TODO: When Hardhat Ignition supports OpenZeppelin proxies, replace with:
  // const queueBeacon = m.deployBeacon("ArcaQueueHandlerV1");
  // const feeBeacon = m.deployBeacon("ArcaFeeManagerV1");
  // const queueProxy = m.deployBeaconProxy(queueBeacon, "ArcaQueueHandlerV1", []);
  // const feeProxy = m.deployBeaconProxy(feeBeacon, "ArcaFeeManagerV1", [feeRecipient]);
  // const rewardProxy = m.deployProxy("ArcaRewardClaimerV1", [...], { kind: 'uups' });
  // const vaultProxy = m.deployProxy("ArcaTestnetV1", [...], { kind: 'uups' });

  // Step 2: Deploy Registry
  const registry = m.contract("ArcaVaultRegistry");

  // Return implementation contracts for now
  // Future: Return proxy contracts when Ignition supports them
  return {
    // Implementation contracts (current)
    queueHandlerImpl,
    feeManagerImpl,
    rewardClaimerImpl,
    vaultImpl,
    registry,
    
    // Future proxy contracts (when Ignition supports OpenZeppelin proxies)
    // queueProxy,
    // feeProxy,
    // rewardProxy,
    // vaultProxy,
  };
});

export default arcaProxySystemModule;
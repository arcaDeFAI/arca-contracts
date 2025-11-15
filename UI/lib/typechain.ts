// TypeChain bridge module - provides typed contract factories and ABIs
// This module exports TypeChain-generated factories for type-safe contract interactions

// Shadow Strategy exports
export { ShadowStrategy__factory } from '@typechain/factories/contracts-shadow/src/ShadowStrategy__factory'
export type { ShadowStrategy } from '@typechain/contracts-shadow/src/ShadowStrategy'

// Oracle Reward Shadow Vault exports
export { OracleRewardShadowVault__factory } from '@typechain/factories/contracts-shadow/src/OracleRewardShadowVault__factory'
export type { OracleRewardShadowVault } from '@typechain/contracts-shadow/src/OracleRewardShadowVault'

// Metropolis Vault exports
export { OracleRewardVault__factory } from '@typechain/factories/contracts-metropolis/src/OracleRewardVault__factory'
export type { OracleRewardVault } from '@typechain/contracts-metropolis/src/OracleRewardVault'

// Metropolis Strategy exports
export { MetropolisStrategy__factory } from '@typechain/factories/contracts-metropolis/src/MetropolisStrategy__factory'
export type { MetropolisStrategy } from '@typechain/contracts-metropolis/src/MetropolisStrategy'

// Shadow CL Pool exports
export { IRamsesV3Pool__factory } from '@typechain/factories/contracts-shadow/CL/core/interfaces/IRamsesV3Pool__factory'
export type { IRamsesV3Pool } from '@typechain/contracts-shadow/CL/core/interfaces/IRamsesV3Pool'

// LB Pair exports (for Metropolis)
export { ILBPair__factory } from '@typechain/factories/@arca/joe-v2/interfaces/ILBPair__factory'
export type { ILBPair } from '@typechain/@arca/joe-v2/interfaces/ILBPair'

// Minimal interfaces for rewards
export { IMinimalGauge__factory } from '@typechain/factories/contracts-shadow/src/interfaces/IMinimalGauge__factory'
export type { IMinimalGauge } from '@typechain/contracts-shadow/src/interfaces/IMinimalGauge'

export { IMinimalVoter__factory } from '@typechain/factories/contracts-shadow/src/interfaces/IMinimalVoter__factory'
export type { IMinimalVoter } from '@typechain/contracts-shadow/src/interfaces/IMinimalVoter'

// Extract ABIs for compatibility with existing wagmi usage patterns
import { ShadowStrategy__factory } from '@typechain/factories/contracts-shadow/src/ShadowStrategy__factory'
import { OracleRewardVault__factory } from '@typechain/factories/contracts-metropolis/src/OracleRewardVault__factory'
import { MetropolisStrategy__factory } from '@typechain/factories/contracts-metropolis/src/MetropolisStrategy__factory'
import { OracleRewardShadowVault__factory } from '@typechain/factories/contracts-shadow/src/OracleRewardShadowVault__factory'
import { IRamsesV3Pool__factory } from '@typechain/factories/contracts-shadow/CL/core/interfaces/IRamsesV3Pool__factory'
import { ILBPair__factory } from '@typechain/factories/@arca/joe-v2/interfaces/ILBPair__factory'
import { IMinimalGauge__factory } from '@typechain/factories/contracts-shadow/src/interfaces/IMinimalGauge__factory'
import { IMinimalVoter__factory } from '@typechain/factories/contracts-shadow/src/interfaces/IMinimalVoter__factory'

export const SHADOW_STRAT_ABI = ShadowStrategy__factory.abi
export const METRO_VAULT_ABI = OracleRewardVault__factory.abi
export const METRO_STRAT_ABI = MetropolisStrategy__factory.abi
export const SHADOW_VAULT_ABI = OracleRewardShadowVault__factory.abi
export const CL_POOL_ABI = IRamsesV3Pool__factory.abi
export const LB_BOOK_ABI = ILBPair__factory.abi
export const SHADOW_REWARDS_ABI = IMinimalGauge__factory.abi
export const VOTER_CLAIM_ABI = IMinimalVoter__factory.abi

// Type definitions for better type safety
export type ShadowRewardStatus = {
  tokens: string[];
  earned: bigint[];
  gaugeAddress: string;
  hasActivePosition: boolean;
}

export type UserRewardStructOutput = {
  token: string;
  pendingRewards: bigint;
}
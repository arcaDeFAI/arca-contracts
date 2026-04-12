import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts"
import { RewardForwarded, RebalanceStarted } from "../generated/ShadowStrategyUSSDUSDC/ShadowStrategy"
import { RebalanceStart } from "../generated/MetroStrategyUSSDUSDC/MetropolisStrategy"
import { Transfer } from "../generated/MetroToken/ERC20"
import { MetroVault } from "../generated/MetroStrategyUSSDUSDC/MetroVault"
import { CLPool } from "../generated/ShadowStrategyUSSDUSDC/CLPool"
import { LBPair } from "../generated/MetroStrategyUSSDUSDC/LBPair"
import { Vault, RewardEvent, Snapshot, ILSnapshot } from "../generated/schema"

// ── Shadow: Strategy → Vault address map ─────────────────────────────────────
export function getShadowVault(strategy: Bytes): Bytes {
  if (strategy.equals(Bytes.fromHexString("0x4ddB609F6D03dC29172c51C6D7f3a2B66e997c18"))) return Bytes.fromHexString("0xc318C24c8A8584B03019D34E586DAa14F208eF2d")
  if (strategy.equals(Bytes.fromHexString("0x496932dD85dB0E9A64F08e529E91cF86D7A65775"))) return Bytes.fromHexString("0x3a284cc4080F9d88aC2eE330296975C78C53B5cd")
  if (strategy.equals(Bytes.fromHexString("0x64efeA2531f2b1A3569555084B88bb5714f5286c"))) return Bytes.fromHexString("0x727e6D1FF1f1836Bb7Cdfad30e89EdBbef878ab5")
  if (strategy.equals(Bytes.fromHexString("0x58c244BE630753e8E668f18C0F2Cffe3ea0E8126"))) return Bytes.fromHexString("0xB6a8129779E57845588Db74435A9aFAE509e1454")
  if (strategy.equals(Bytes.fromHexString("0x0806709c30A2999867160A1e4064f29ecCFA4605"))) return Bytes.fromHexString("0xd4083994F3ce977bcb5d3022041D489B162f5B85")
  return Bytes.empty()
}

// ── Shadow: Strategy → CL Pool address map (for sqrtPriceX96 capture) ────────
export function getShadowPool(strategy: Bytes): Bytes {
  if (strategy.equals(Bytes.fromHexString("0x4ddB609F6D03dC29172c51C6D7f3a2B66e997c18"))) return Bytes.fromHexString("0x092c0B146201Bb16D9A37cFC0a7310b05fc8799b")
  if (strategy.equals(Bytes.fromHexString("0x496932dD85dB0E9A64F08e529E91cF86D7A65775"))) return Bytes.fromHexString("0x356C9EB08f9121cfB00AD6Dc03A12422eEf8a9A8")
  if (strategy.equals(Bytes.fromHexString("0x64efeA2531f2b1A3569555084B88bb5714f5286c"))) return Bytes.fromHexString("0x324963c267C354c7660Ce8CA3F5f167E05649970")
  if (strategy.equals(Bytes.fromHexString("0x58c244BE630753e8E668f18C0F2Cffe3ea0E8126"))) return Bytes.fromHexString("0xb6d9b069f6b96a507243d501d1a23b3fccfc85d3")
  if (strategy.equals(Bytes.fromHexString("0x0806709c30A2999867160A1e4064f29ecCFA4605"))) return Bytes.fromHexString("0x6fb30f3fcb864d49cdff15061ed5c6adfee40b40")
  return Bytes.empty()
}

// ── Metropolis ────────────────────────────────────────────────────────────────

export function getMetroVault(strategy: Bytes): Bytes {
  // Archived vault kept for historical reward data
  if (strategy.equals(Bytes.fromHexString("0x20302bc08CcaAFB039916e4a06f0B3917506019a"))) return Bytes.fromHexString("0xF5708969da13879d7A6D2F21d0411BF9eEB045E9")
  if (strategy.equals(Bytes.fromHexString("0x7069B87c64ee8DA6bF928B4Af0693bC7a4f9D7e6"))) return Bytes.fromHexString("0xBaef4Da824f554c35035211cb997db4ecB75F45f")
  if (strategy.equals(Bytes.fromHexString("0xeca4AE2D4778b1417d6cB47B9C7769e9f5fC4A3f"))) return Bytes.fromHexString("0x1C0C5A4197b7Fa25a180E6e08eA19A91EBBe5fD2")
  if (strategy.equals(Bytes.fromHexString("0x38FdF9a12Ac2e2aD95dd5bE3d271cC6EA23C5c2C"))) return Bytes.fromHexString("0x34331E66a634D69D64edC3e21E52A53899e12640")
  return Bytes.empty()
}

// ── Metro: Strategy → LBPair address map (for getPriceFromId capture) ─────────
// Mirrors lbBookAddress entries in UI/lib/vaultConfigs.ts
export function getMetroLBPair(strategy: Bytes): Bytes {
  if (strategy.equals(Bytes.fromHexString("0x7069B87c64ee8DA6bF928B4Af0693bC7a4f9D7e6"))) return Bytes.fromHexString("0x12f1cacda05242ccfe4c7139a46b8545bd2b2537")
  if (strategy.equals(Bytes.fromHexString("0xeca4AE2D4778b1417d6cB47B9C7769e9f5fC4A3f"))) return Bytes.fromHexString("0x361f55337074ae43957204cb30ffbabbce4fb837")
  if (strategy.equals(Bytes.fromHexString("0x38FdF9a12Ac2e2aD95dd5bE3d271cC6EA23C5c2C"))) return Bytes.fromHexString("0x9eDE606c7168bb09fF73EbdE7bFD6FcfaBDA9Bc3")
  return Bytes.empty()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreateVault(vaultAddress: Bytes, strategyAddress: Bytes, protocol: string): Vault {
  let vault = Vault.load(vaultAddress)
  if (!vault) {
    vault = new Vault(vaultAddress)
    vault.strategy = strategyAddress
    vault.protocol = protocol
    vault.save()
  }
  return vault
}

// Call previewAmounts(1 share unit) on the vault contract.
// Shadow vaults: shareDecimals = tokenYDecimals + 6 (USDC=6 → 12, USSD=18 → 24)
// Metro vaults:  same formula
// We call with 1e18 as a safe standard unit — the ratio is what matters for pps tracking.
function callPreviewAmounts(vaultAddr: Bytes): BigInt[] {
  let contract = MetroVault.bind(Address.fromBytes(vaultAddr))
  let result = contract.try_previewAmounts(BigInt.fromString("1000000000000000000")) // 1e18 shares
  if (result.reverted) {
    return [BigInt.zero(), BigInt.zero()]
  }
  return [result.value.getAmountX(), result.value.getAmountY()]
}

function callGetBalances(vaultAddr: Bytes): BigInt[] {
  let contract = MetroVault.bind(Address.fromBytes(vaultAddr))
  let result = contract.try_getBalances()
  if (result.reverted) {
    return [BigInt.zero(), BigInt.zero()]
  }
  return [result.value.getAmountX(), result.value.getAmountY()]
}

// Create a Snapshot and update ILSnapshot — called from both Shadow and Metro rebalance handlers.
// sqrtPriceX96: Shadow CL pool slot0 price (0 for Metro)
// lbPrice:      Metro LBPair.getPriceFromId(desiredActiveId) scaled by 2^128 (0 for Shadow)
function recordSnapshot(
  vaultAddress: Bytes,
  tickLower: i32,
  tickUpper: i32,
  timestamp: BigInt,
  blockNumber: BigInt,
  txHash: Bytes,
  logIndex: i32,
  sqrtPriceX96: BigInt,
  lbPrice: BigInt
): void {
  // On-chain calls for per-share amounts and total balances
  let perShare = callPreviewAmounts(vaultAddress)
  let balances = callGetBalances(vaultAddress)

  let snapId = vaultAddress.concat(txHash).concatI32(logIndex)
  let snap = new Snapshot(snapId)
  snap.vault = vaultAddress
  snap.amountXPerShare = perShare[0]
  snap.amountYPerShare = perShare[1]
  snap.totalBalanceX = balances[0]
  snap.totalBalanceY = balances[1]
  snap.tickLower = tickLower
  snap.tickUpper = tickUpper
  snap.sqrtPriceX96 = sqrtPriceX96
  snap.lbPrice = lbPrice
  snap.timestamp = timestamp
  snap.blockNumber = blockNumber
  snap.txHash = txHash
  snap.save()

  // Update ILSnapshot (mutable, one row per vault)
  let il = ILSnapshot.load(vaultAddress)
  if (!il) {
    // First rebalance — set baseline
    il = new ILSnapshot(vaultAddress)
    il.vault = vaultAddress
    il.firstAmountXPerShare = perShare[0]
    il.firstAmountYPerShare = perShare[1]
    il.firstTimestamp = timestamp
    il.snapshotCount = BigInt.zero()
    il.totalBalanceXSum = BigInt.zero()
    il.totalBalanceYSum = BigInt.zero()
    il.totalRewardAmount = BigInt.zero()
    il.firstSqrtPriceX96 = sqrtPriceX96
    il.firstLBPrice = lbPrice
  }
  // Always update latest
  il.latestAmountXPerShare = perShare[0]
  il.latestAmountYPerShare = perShare[1]
  il.latestTimestamp = timestamp
  il.snapshotCount = il.snapshotCount.plus(BigInt.fromI32(1))
  il.totalBalanceXSum = il.totalBalanceXSum.plus(balances[0])
  il.totalBalanceYSum = il.totalBalanceYSum.plus(balances[1])
  il.latestSqrtPriceX96 = sqrtPriceX96
  il.latestLBPrice = lbPrice
  il.save()
}

export function handleRewardForwardedShadow(event: RewardForwarded): void {
  let strategyAddress = event.address
  let vaultAddress = event.params.vault

  getOrCreateVault(vaultAddress, strategyAddress, "shadow")

  let rewardId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let reward = new RewardEvent(rewardId)
  reward.vault = vaultAddress
  reward.strategy = strategyAddress
  reward.rewardToken = event.params.token
  reward.amount = event.params.amount
  reward.timestamp = event.block.timestamp
  reward.blockNumber = event.block.number
  reward.txHash = event.transaction.hash
  reward.save()

  // Accumulate reward amount into ILSnapshot for reward_apr calculation
  let il = ILSnapshot.load(vaultAddress)
  if (il) {
    il.totalRewardAmount = il.totalRewardAmount.plus(event.params.amount)
    il.save()
  }
}

// Called on every Shadow rebalance — captures pps + sqrtPriceX96 snapshot for fee_apr + IL
export function handleRebalanceStartedShadow(event: RebalanceStarted): void {
  let strategyAddress = event.address
  let vaultAddress = getShadowVault(strategyAddress)
  if (vaultAddress.length == 0) return

  getOrCreateVault(vaultAddress, strategyAddress, "shadow")

  // Capture sqrtPriceX96 from the CL pool for IL computation
  let sqrtPriceX96 = BigInt.zero()
  let poolAddr = getShadowPool(strategyAddress)
  if (poolAddr.length > 0) {
    let pool = CLPool.bind(Address.fromBytes(poolAddr))
    let slot0Result = pool.try_slot0()
    if (!slot0Result.reverted) {
      sqrtPriceX96 = slot0Result.value.getSqrtPriceX96()
    }
  }

  recordSnapshot(
    vaultAddress,
    event.params.tickLower,
    event.params.tickUpper,
    event.block.timestamp,
    event.block.number,
    event.transaction.hash,
    event.logIndex.toI32(),
    sqrtPriceX96,
    BigInt.zero()
  )
}

const METRO_TOKEN = Bytes.fromHexString("0x71e99522ead5e21cf57f1f542dc4ad2e841f7321")

export function handleMetroTransfer(event: Transfer): void {
  const strategy = event.params.from
  const vaultAddress = getMetroVault(strategy)

  // Verify this is a Transfer from a known Strategy to its specific Vault
  if (vaultAddress.length > 0 && event.params.to.equals(vaultAddress)) {
    getOrCreateVault(vaultAddress, strategy, "metropolis")

    let rewardId = event.transaction.hash.concatI32(event.logIndex.toI32())
    let reward = new RewardEvent(rewardId)
    reward.vault = vaultAddress
    reward.strategy = strategy
    reward.rewardToken = METRO_TOKEN
    reward.amount = event.params.value
    reward.timestamp = event.block.timestamp
    reward.blockNumber = event.block.number
    reward.txHash = event.transaction.hash
    reward.save()

    // Accumulate reward amount into ILSnapshot
    let il = ILSnapshot.load(vaultAddress)
    if (il) {
      il.totalRewardAmount = il.totalRewardAmount.plus(event.params.value)
      il.save()
    }
  }
}

// Called on every Metro rebalance — captures pps + LBPair price snapshot for fee_apr + IL
// RebalanceStart uses uint24 bins (not ticks) — we cast to i32 for storage
export function handleRebalanceStartMetro(event: RebalanceStart): void {
  const strategy = event.address
  const vaultAddress = getMetroVault(strategy)
  if (vaultAddress.length == 0) return

  getOrCreateVault(vaultAddress, strategy, "metropolis")

  // Capture getPriceFromId(desiredActiveId) from the LBPair for IL computation
  // Returns price of X in Y scaled by 2^128 — same formula PositionVisualizer uses
  let lbPrice = BigInt.zero()
  let lbPairAddr = getMetroLBPair(strategy)
  if (lbPairAddr.length > 0) {
    let pair = LBPair.bind(Address.fromBytes(lbPairAddr))
    let priceResult = pair.try_getPriceFromId(event.params.desiredActiveId)
    if (!priceResult.reverted) {
      lbPrice = priceResult.value
    }
  }

  recordSnapshot(
    vaultAddress,
    event.params.newLower as i32,
    event.params.newUpper as i32,
    event.block.timestamp,
    event.block.number,
    event.transaction.hash,
    event.logIndex.toI32(),
    BigInt.zero(),
    lbPrice
  )
}

import { BigInt, BigDecimal, Bytes, Address } from "@graphprotocol/graph-ts"
import { RewardForwarded, RebalanceStarted } from "../generated/ShadowStrategyUSSDUSDC/ShadowStrategy"
import { RebalanceStart } from "../generated/MetroStrategyUSSDUSDC/MetropolisStrategy"
import { Transfer } from "../generated/MetroToken/ERC20"
import { Harvested, Transfer as ShareTransfer, ArcaVault } from "../generated/MetroVaultUSSDUSDC/ArcaVault"
import { MetroVault } from "../generated/MetroStrategyUSSDUSDC/MetroVault"
import { CLPool } from "../generated/ShadowStrategyUSSDUSDC/CLPool"
import { LBPair } from "../generated/MetroStrategyUSSDUSDC/LBPair"
import { PriceERC20 } from "../generated/ShadowStrategyUSSDUSDC/PriceERC20"
import { Vault, RewardEvent, Snapshot, ILSnapshot, UserHarvestEvent, TokenPrice, VaultDayData, UserVaultPosition } from "../generated/schema"

// â”€â”€ Shadow: Strategy â†’ Vault address map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function getShadowVault(strategy: Bytes): Bytes {
  if (strategy.equals(Bytes.fromHexString("0x4ddB609F6D03dC29172c51C6D7f3a2B66e997c18"))) return Bytes.fromHexString("0xc318C24c8A8584B03019D34E586DAa14F208eF2d")
  if (strategy.equals(Bytes.fromHexString("0x496932dD85dB0E9A64F08e529E91cF86D7A65775"))) return Bytes.fromHexString("0x3a284cc4080F9d88aC2eE330296975C78C53B5cd")
  if (strategy.equals(Bytes.fromHexString("0x64efeA2531f2b1A3569555084B88bb5714f5286c"))) return Bytes.fromHexString("0x727e6D1FF1f1836Bb7Cdfad30e89EdBbef878ab5")
  if (strategy.equals(Bytes.fromHexString("0x58c244BE630753e8E668f18C0F2Cffe3ea0E8126"))) return Bytes.fromHexString("0xB6a8129779E57845588Db74435A9aFAE509e1454")
  if (strategy.equals(Bytes.fromHexString("0x0806709c30A2999867160A1e4064f29ecCFA4605"))) return Bytes.fromHexString("0xd4083994F3ce977bcb5d3022041D489B162f5B85")
  return Bytes.empty()
}

// â”€â”€ Shadow: Strategy â†’ CL Pool address map (for sqrtPriceX96 capture) â”€â”€â”€â”€â”€â”€â”€â”€
export function getShadowPool(strategy: Bytes): Bytes {
  if (strategy.equals(Bytes.fromHexString("0x4ddB609F6D03dC29172c51C6D7f3a2B66e997c18"))) return Bytes.fromHexString("0x092c0B146201Bb16D9A37cFC0a7310b05fc8799b")
  if (strategy.equals(Bytes.fromHexString("0x496932dD85dB0E9A64F08e529E91cF86D7A65775"))) return Bytes.fromHexString("0x356C9EB08f9121cfB00AD6Dc03A12422eEf8a9A8")
  if (strategy.equals(Bytes.fromHexString("0x64efeA2531f2b1A3569555084B88bb5714f5286c"))) return Bytes.fromHexString("0x324963c267C354c7660Ce8CA3F5f167E05649970")
  if (strategy.equals(Bytes.fromHexString("0x58c244BE630753e8E668f18C0F2Cffe3ea0E8126"))) return Bytes.fromHexString("0xb6d9b069f6b96a507243d501d1a23b3fccfc85d3")
  if (strategy.equals(Bytes.fromHexString("0x0806709c30A2999867160A1e4064f29ecCFA4605"))) return Bytes.fromHexString("0x6fb30f3fcb864d49cdff15061ed5c6adfee40b40")
  return Bytes.empty()
}

// â”€â”€ Metropolis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getMetroVault(strategy: Bytes): Bytes {
  // Archived vault kept for historical reward data
  if (strategy.equals(Bytes.fromHexString("0x20302bc08CcaAFB039916e4a06f0B3917506019a"))) return Bytes.fromHexString("0xF5708969da13879d7A6D2F21d0411BF9eEB045E9")
  if (strategy.equals(Bytes.fromHexString("0x7069B87c64ee8DA6bF928B4Af0693bC7a4f9D7e6"))) return Bytes.fromHexString("0xBaef4Da824f554c35035211cb997db4ecB75F45f")
  if (strategy.equals(Bytes.fromHexString("0xeca4AE2D4778b1417d6cB47B9C7769e9f5fC4A3f"))) return Bytes.fromHexString("0x1C0C5A4197b7Fa25a180E6e08eA19A91EBBe5fD2")
  if (strategy.equals(Bytes.fromHexString("0x38FdF9a12Ac2e2aD95dd5bE3d271cC6EA23C5c2C"))) return Bytes.fromHexString("0x34331E66a634D69D64edC3e21E52A53899e12640")
  return Bytes.empty()
}

// â”€â”€ Metro: Strategy â†’ LBPair address map (for getPriceFromId capture) â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Mirrors lbBookAddress entries in UI/lib/vaultConfigs.ts
export function getMetroLBPair(strategy: Bytes): Bytes {
  if (strategy.equals(Bytes.fromHexString("0x7069B87c64ee8DA6bF928B4Af0693bC7a4f9D7e6"))) return Bytes.fromHexString("0x12f1cacda05242ccfe4c7139a46b8545bd2b2537")
  if (strategy.equals(Bytes.fromHexString("0xeca4AE2D4778b1417d6cB47B9C7769e9f5fC4A3f"))) return Bytes.fromHexString("0x361f55337074ae43957204cb30ffbabbce4fb837")
  if (strategy.equals(Bytes.fromHexString("0x38FdF9a12Ac2e2aD95dd5bE3d271cC6EA23C5c2C"))) return Bytes.fromHexString("0x9eDE606c7168bb09fF73EbdE7bFD6FcfaBDA9Bc3")
  return Bytes.empty()
}

// â”€â”€ Token addresses (lowercase) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WS_ADDR   = "0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38"
const USDC_ADDR = "0x29219dd400f2bf60e5a23d13be72b486d4038894"
const USSD_ADDR = "0x000000000eccff26b795f73fb0a70d48da657fef"
const WETH_ADDR = "0x50c42deacd8fc9773493ed674b675be577f2634b"

const BD_ZERO = BigDecimal.fromString("0")
const BD_ONE  = BigDecimal.fromString("1")

// â”€â”€ Reward tokens + the pools used to price them at reward time â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SHADOW_ADDR  = "0x3333b97138d4b086720b5ae8a7844b1345a33333"
const XSHADOW_ADDR = "0x5050bc082ff4a74fb6b0b04385defddb114b2424" // valued 1:1 with SHADOW, same as the UI
const METRO_ADDR   = "0x71e99522ead5e21cf57f1f542dc4ad2e841f7321"
// Constant-product pairs, priced from token balances. Both checked against GeckoTerminal (2026-09-29).
// Shadow legacy USDC/SHADOW volatile pair â€” deepest SHADOW liquidity (~$130k).
const SHADOW_USDC_PAIR = "0xaca297ecc8cbaf15bd78cd0757ee93d6ef82c6b7"
// METRO/wS pair â€” the only METRO pool with real trading; the larger METRO LB pairs hold stale prices.
const METRO_WS_PAIR = "0x9fc6b2cadaa287d2c4d635231b51c96b8cc92859"

// â”€â”€ Token info per vault â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TokenInfo {
  xAddr:   string
  yAddr:   string
  dX:      i32
  dY:      i32
  xStable: bool
  yStable: bool
  constructor(xAddr: string, yAddr: string, dX: i32, dY: i32, xStable: bool, yStable: bool) {
    this.xAddr   = xAddr
    this.yAddr   = yAddr
    this.dX      = dX
    this.dY      = dY
    this.xStable = xStable
    this.yStable = yStable
  }
}

function getTokenInfo(vaultAddr: Bytes): TokenInfo | null {
  let v = vaultAddr.toHexString().toLowerCase()
  // â”€â”€ Metro â”€â”€
  if (v == "0xbaef4da824f554c35035211cb997db4ecb75f45f") return new TokenInfo(USSD_ADDR, USDC_ADDR, 18, 6,  true,  true)  // USSDâ€¢USDC
  if (v == "0x1c0c5a4197b7fa25a180e6e08ea19a91ebbe5fd2") return new TokenInfo(WS_ADDR,   USSD_ADDR, 18, 18, false, true)  // wSâ€¢USSD
  if (v == "0x34331e66a634d69d64edc3e21e52a53899e12640") return new TokenInfo(WETH_ADDR, WS_ADDR,   18, 18, false, false) // WETHâ€¢wS
  // â”€â”€ Shadow â”€â”€
  if (v == "0x727e6d1ff1f1836bb7cdfad30e89edbbef878ab5") return new TokenInfo(WS_ADDR,   USDC_ADDR, 18, 6,  false, true)  // wSâ€¢USDC
  if (v == "0xb6a8129779e57845588db74435a9afae509e1454") return new TokenInfo(WS_ADDR,   WETH_ADDR, 18, 18, false, false) // WSâ€¢WETH
  if (v == "0xd4083994f3ce977bcb5d3022041d489b162f5b85") return new TokenInfo(USDC_ADDR, WETH_ADDR, 6,  18, true,  false) // USDCâ€¢WETH
  if (v == "0xc318c24c8a8584b03019d34e586daa14f208ef2d") return new TokenInfo(USSD_ADDR, USDC_ADDR, 18, 6,  true,  true)  // USSDâ€¢USDC
  if (v == "0x3a284cc4080f9d88ac2ee330296975c78c53b5cd") return new TokenInfo(USSD_ADDR, WS_ADDR,   18, 18, true,  false) // USSDâ€¢wS
  return null
}

// â”€â”€ USD price helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Decimal adjustment factor for pxInY = (raw_sqrt^2) * 10^(dX-dY)
function decimalAdj(dX: i32, dY: i32): BigDecimal {
  let diff = dX - dY
  if (diff ==  12) return BigDecimal.fromString("1000000000000")
  if (diff == -12) return BigDecimal.fromString("0.000000000001")
  return BD_ONE // diff == 0
}

// Convert on-chain price to human-readable X/Y ratio (BigDecimal)
function pxInYBD(sqrtPriceX96: BigInt, lbPrice: BigInt, dX: i32, dY: i32): BigDecimal {
  let adj = decimalAdj(dX, dY)
  if (sqrtPriceX96.gt(BigInt.zero())) {
    let TWO96 = BigDecimal.fromString("79228162514264337593543950336")
    let sq = sqrtPriceX96.toBigDecimal().div(TWO96)
    return sq.times(sq).times(adj)
  }
  if (lbPrice.gt(BigInt.zero())) {
    let TWO128 = BigDecimal.fromString("340282366920938463463374607431768211456")
    return lbPrice.toBigDecimal().div(TWO128).times(adj)
  }
  return BD_ZERO
}

function setTokenPrice(addrStr: string, price: BigDecimal, timestamp: BigInt): void {
  if (price.equals(BD_ZERO)) return
  let id = Bytes.fromHexString(addrStr)
  let tp = TokenPrice.load(id)
  if (!tp) {
    tp = new TokenPrice(id)
  }
  tp.priceUsd    = price
  tp.lastUpdated = timestamp
  tp.save()
}

function getTokenPriceUsd(addrStr: string): BigDecimal {
  let tp = TokenPrice.load(Bytes.fromHexString(addrStr))
  return tp ? tp.priceUsd : BD_ZERO
}

function pow10(decimals: i32): BigDecimal {
  return BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
}

function tokenDecimals(addrStr: string): i32 {
  return addrStr == USDC_ADDR ? 6 : 18
}

// Price of `token` in units of `quote`, from a constant-product pair's token balances.
// Read via ERC20 balances so we don't depend on each pair's own ABI.
function pairPriceInQuote(pairAddr: string, token: string, quote: string): BigDecimal {
  let pair = Address.fromString(pairAddr)
  let tokenBal = PriceERC20.bind(Address.fromString(token)).try_balanceOf(pair)
  let quoteBal = PriceERC20.bind(Address.fromString(quote)).try_balanceOf(pair)
  if (tokenBal.reverted || quoteBal.reverted || tokenBal.value.equals(BigInt.zero())) return BD_ZERO
  return quoteBal.value.toBigDecimal().div(pow10(tokenDecimals(quote)))
    .div(tokenBal.value.toBigDecimal().div(pow10(tokenDecimals(token))))
}

function rewardTokenPriceUsd(token: Bytes): BigDecimal {
  let t = token.toHexString().toLowerCase()
  if (t == SHADOW_ADDR || t == XSHADOW_ADDR) return pairPriceInQuote(SHADOW_USDC_PAIR, SHADOW_ADDR, USDC_ADDR)
  // wS USD price comes from the wSâ€¢USDC vault's rebalances (TokenPrice store)
  if (t == METRO_ADDR) return pairPriceInQuote(METRO_WS_PAIR, METRO_ADDR, WS_ADDR).times(getTokenPriceUsd(WS_ADDR))
  // Any other reward token that is also a vault pair token (wS, WETH, USDCâ€¦)
  return getTokenPriceUsd(t)
}

function getOrCreateDayData(vaultAddress: Bytes, timestamp: BigInt): VaultDayData {
  let dayIndex = timestamp.toI32() / 86400
  let id = vaultAddress.concatI32(dayIndex)
  let day = VaultDayData.load(id)
  if (!day) {
    day = new VaultDayData(id)
    day.vault = vaultAddress
    day.date = dayIndex * 86400
    day.rewardsUsd = BD_ZERO
    day.unpricedRewardEvents = 0
    day.rebalanceCount = 0
    let vault = Vault.load(vaultAddress)
    if (vault) {
      day.tvlUsd = vault.lastTvlUsd
    }
  }
  return day
}

function recordRewardUsd(vaultAddress: Bytes, token: Bytes, amount: BigInt, timestamp: BigInt): void {
  let day = getOrCreateDayData(vaultAddress, timestamp)
  let price = rewardTokenPriceUsd(token)
  if (price.equals(BD_ZERO)) {
    day.unpricedRewardEvents = day.unpricedRewardEvents + 1
  } else {
    let decimals = tokenDecimals(token.toHexString().toLowerCase())
    day.rewardsUsd = day.rewardsUsd.plus(amount.toBigDecimal().div(pow10(decimals)).times(price))
  }
  day.save()
}

// Derive USD prices for tokenX and tokenY from the in-pair price + TokenPrice store.
// Returns [priceXUsd, priceYUsd]; either may be BD_ZERO if not yet known.
function deriveUsdPrices(
  info: TokenInfo,
  sqrtPriceX96: BigInt,
  lbPrice: BigInt,
  timestamp: BigInt
): BigDecimal[] {
  let px = pxInYBD(sqrtPriceX96, lbPrice, info.dX, info.dY)

  if (info.xStable && info.yStable) {
    // Both stablecoins â†’ both $1
    setTokenPrice(info.xAddr, BD_ONE, timestamp)
    setTokenPrice(info.yAddr, BD_ONE, timestamp)
    return [BD_ONE, BD_ONE]
  }

  if (info.yStable && px.gt(BD_ZERO)) {
    // Y â‰ˆ $1 â†’ priceX = pxInY (X per USDC/USSD)
    setTokenPrice(info.xAddr, px, timestamp)
    setTokenPrice(info.yAddr, BD_ONE, timestamp)
    return [px, BD_ONE]
  }

  if (info.xStable && px.gt(BD_ZERO)) {
    // X â‰ˆ $1 â†’ priceY = 1/pxInY  (e.g. USDC/WETH: pxInY = 1/WETH_USD)
    let priceY = BD_ONE.div(px)
    setTokenPrice(info.xAddr, BD_ONE, timestamp)
    setTokenPrice(info.yAddr, priceY, timestamp)
    return [BD_ONE, priceY]
  }

  // Both volatile â€” look up prices set by other stable-pair vaults
  let priceX = getTokenPriceUsd(info.xAddr)
  let priceY = getTokenPriceUsd(info.yAddr)
  return [priceX, priceY]
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getOrCreateVault(vaultAddress: Bytes, strategyAddress: Bytes, protocol: string): Vault {
  let vault = Vault.load(vaultAddress)
  if (!vault || vault.protocol == "unknown") {
    // Also fills in placeholders created by Harvested / share Transfer handlers
    if (!vault) vault = new Vault(vaultAddress)
    vault.strategy = strategyAddress
    vault.protocol = protocol
    vault.save()
  }
  return vault!
}

// Call previewAmounts(1 share unit) on the vault contract, normalized to 1e24 per-share.
// Metro vaults: previewAmounts(1e24) succeeds directly.
// Shadow vaults: previewAmounts(1e24) reverts because the contract guards shares > totalSupply.
//   Fallback: call previewAmounts(totalSupply) â†’ returns (totalX, totalY), then scale to 1e24.
//   amountXPerShare = totalX * 1e24 / totalSupply  (safe: uint256 holds up to ~1e46 for typical TVL)
// The 1e24 normalization ensures firstâ†’latest ratios are scale-consistent across all vault types.
function callPreviewAmounts(vaultAddr: Bytes): BigInt[] {
  let contract = MetroVault.bind(Address.fromBytes(vaultAddr))
  let ONE_E24 = BigInt.fromString("1000000000000000000000000")

  // Primary path: works for Metro vaults and Shadow vaults with totalSupply >= 1e24
  let result = contract.try_previewAmounts(ONE_E24)
  if (!result.reverted) {
    return [result.value.getAmountX(), result.value.getAmountY()]
  }

  // Fallback for Shadow vaults: previewAmounts reverts when shares > totalSupply.
  // Get totalSupply, call previewAmounts(totalSupply), then normalize to 1e24 per-share.
  let supplyResult = contract.try_totalSupply()
  if (supplyResult.reverted || supplyResult.value.equals(BigInt.zero())) {
    return [BigInt.zero(), BigInt.zero()]
  }
  let supply = supplyResult.value
  let result2 = contract.try_previewAmounts(supply)
  if (result2.reverted) {
    return [BigInt.zero(), BigInt.zero()]
  }
  // Normalize: amountXPerShare = totalX * 1e24 / supply
  let amountX = result2.value.getAmountX().times(ONE_E24).div(supply)
  let amountY = result2.value.getAmountY().times(ONE_E24).div(supply)
  return [amountX, amountY]
}

function callGetBalances(vaultAddr: Bytes): BigInt[] {
  let contract = MetroVault.bind(Address.fromBytes(vaultAddr))
  let result = contract.try_getBalances()
  if (result.reverted) {
    return [BigInt.zero(), BigInt.zero()]
  }
  return [result.value.getAmountX(), result.value.getAmountY()]
}

// Create a Snapshot and update ILSnapshot â€” called from both Shadow and Metro rebalance handlers.
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

  // Derive USD prices for both tokens (vault_tracker method).
  // Stable-pair vaults write to TokenPrice; volatile-volatile vaults read from it.
  let info = getTokenInfo(vaultAddress)
  let priceXUsd = BD_ZERO
  let priceYUsd = BD_ZERO
  if (info !== null) {
    let prices = deriveUsdPrices(info, sqrtPriceX96, lbPrice, timestamp)
    priceXUsd = prices[0]
    priceYUsd = prices[1]
  }

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
  snap.priceXUsd = priceXUsd.equals(BD_ZERO) ? null : priceXUsd
  snap.priceYUsd = priceYUsd.equals(BD_ZERO) ? null : priceYUsd
  snap.timestamp = timestamp
  snap.blockNumber = blockNumber
  snap.txHash = txHash
  snap.save()

  // Points accrue on the previous share price up to now, before it is replaced below
  advancePointsIndex(vaultAddress, timestamp)

  // Daily TVL / price-per-share for the history charts (needs both USD prices)
  if (info !== null && priceXUsd.gt(BD_ZERO) && priceYUsd.gt(BD_ZERO)) {
    let tvlUsd = balances[0].toBigDecimal().div(pow10(info.dX)).times(priceXUsd)
      .plus(balances[1].toBigDecimal().div(pow10(info.dY)).times(priceYUsd))
    let ppsUsd = perShare[0].toBigDecimal().div(pow10(info.dX)).times(priceXUsd)
      .plus(perShare[1].toBigDecimal().div(pow10(info.dY)).times(priceYUsd))

    let vault = Vault.load(vaultAddress)
    if (vault) {
      vault.lastTvlUsd = tvlUsd
      if (ppsUsd.gt(BD_ZERO)) vault.lastPpsUsd = ppsUsd
      vault.save()
    }
    let day = getOrCreateDayData(vaultAddress, timestamp)
    day.tvlUsd = tvlUsd
    day.ppsUsd = ppsUsd
    day.priceXUsd = priceXUsd
    day.priceYUsd = priceYUsd
    day.rebalanceCount = day.rebalanceCount + 1
    day.save()
  }

  // Update ILSnapshot (mutable, one row per vault)
  let il = ILSnapshot.load(vaultAddress)
  if (!il) {
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
    // Store USD prices at baseline â€” enables vault_tracker USD PPS method
    il.firstPriceXUsd = priceXUsd.equals(BD_ZERO) ? null : priceXUsd
    il.firstPriceYUsd = priceYUsd.equals(BD_ZERO) ? null : priceYUsd
  } else if (
    il.firstAmountXPerShare.equals(BigInt.zero()) &&
    il.firstAmountYPerShare.equals(BigInt.zero()) &&
    (perShare[0].gt(BigInt.zero()) || perShare[1].gt(BigInt.zero()))
  ) {
    // Previous first snapshot was taken when vault was empty (totalSupply=0 â†’ previewAmounts=0).
    // Promote the current non-zero snapshot to be the baseline for IL/vsHodl.
    il.firstAmountXPerShare = perShare[0]
    il.firstAmountYPerShare = perShare[1]
    il.firstTimestamp = timestamp
    il.firstSqrtPriceX96 = sqrtPriceX96
    il.firstLBPrice = lbPrice
    il.firstPriceXUsd = priceXUsd.equals(BD_ZERO) ? null : priceXUsd
    il.firstPriceYUsd = priceYUsd.equals(BD_ZERO) ? null : priceYUsd
  } else {
    // Backfill any missing first prices independently.
    // Happens when a volatile-volatile vault (e.g. WSâ€¢WETH) baseline was set before
    // stable-pair vaults had seeded TokenPrice for one or both of its tokens.
    if (il.firstPriceXUsd === null && !priceXUsd.equals(BD_ZERO)) {
      il.firstPriceXUsd = priceXUsd
    }
    if (il.firstPriceYUsd === null && !priceYUsd.equals(BD_ZERO)) {
      il.firstPriceYUsd = priceYUsd
    }
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

  recordRewardUsd(vaultAddress, event.params.token, event.params.amount, event.block.timestamp)
}

// Called on every Shadow rebalance â€” captures pps + sqrtPriceX96 snapshot for fee_apr + IL
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

    recordRewardUsd(vaultAddress, METRO_TOKEN, event.params.value, event.block.timestamp)
  }
}

// â”€â”€ Vault: Harvested events (user-specific reward claims) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Called whenever a user claims rewards from any Arca vault.
// event.address is the vault address itself (not the strategy).
export function handleHarvested(event: Harvested): void {
  const vaultAddress = event.address

  // Vault may not exist yet if this fires before the first rebalance snapshot.
  // Create a placeholder so the foreign key constraint holds â€” protocol will be
  // patched to the correct value once a RewardForwarded / RebalanceStart is seen.
  let vault = Vault.load(vaultAddress)
  if (!vault) {
    vault = new Vault(vaultAddress)
    vault.strategy = vaultAddress  // placeholder; updated by reward/rebalance handlers
    vault.protocol = "unknown"
    vault.save()
  }

  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const harvestEvent = new UserHarvestEvent(id)
  harvestEvent.vault = vaultAddress
  harvestEvent.user = event.params.user
  harvestEvent.token = event.params.token
  harvestEvent.amount = event.params.amount
  harvestEvent.timestamp = event.block.timestamp
  harvestEvent.blockNumber = event.block.number
  harvestEvent.txHash = event.transaction.hash
  harvestEvent.save()
}

// Called on every Metro rebalance â€” captures pps + LBPair price snapshot for fee_apr + IL
// RebalanceStart uses uint24 bins (not ticks) â€” we cast to i32 for storage
export function handleRebalanceStartMetro(event: RebalanceStart): void {
  const strategy = event.address
  const vaultAddress = getMetroVault(strategy)
  if (vaultAddress.length == 0) return

  getOrCreateVault(vaultAddress, strategy, "metropolis")

  // Capture getPriceFromId(desiredActiveId) from the LBPair for IL computation
  // Returns price of X in Y scaled by 2^128 â€” same formula PositionVisualizer uses
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

// â”€â”€ Points â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 1 point per $1 held per day. Each vault keeps a cumulative "points per share" index,
// advanced at every rebalance and share transfer; a wallet earns shares Ã— index growth.

const SHARE_UNIT = BigDecimal.fromString("1000000000000000000000000") // ppsUsd is per 1e24 raw shares
const ZERO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000")

// Share of points forfeited on shares that leave a wallet, by holding time
function penaltyRate(ageSeconds: BigInt): BigDecimal {
  let days = ageSeconds.toI64() / 86400
  if (days < 7) return BigDecimal.fromString("1")
  if (days < 30) return BigDecimal.fromString("0.5")
  if (days < 90) return BigDecimal.fromString("0.25")
  return BD_ZERO
}

function advancePointsIndex(vaultAddress: Bytes, timestamp: BigInt): Vault {
  let vault = Vault.load(vaultAddress)
  if (!vault) {
    // Vaults are indexed from deployment, so a transfer can come before the first rebalance
    vault = new Vault(vaultAddress)
    vault.strategy = vaultAddress
    vault.protocol = "unknown"
  }
  let index = vault.pointsIndex !== null ? vault.pointsIndex! : BD_ZERO
  if (vault.pointsIndexUpdatedAt !== null && vault.lastPpsUsd !== null) {
    let days = timestamp.minus(vault.pointsIndexUpdatedAt!).toBigDecimal().div(BigDecimal.fromString("86400"))
    index = index.plus(vault.lastPpsUsd!.div(SHARE_UNIT).times(days))
  }
  vault.pointsIndex = index
  vault.pointsIndexUpdatedAt = timestamp
  vault.save()
  return vault
}

// Load a wallet's position and credit points earned since its last update
function settledPosition(vault: Vault, user: Address, timestamp: BigInt): UserVaultPosition {
  let id = vault.id.concat(user)
  let pos = UserVaultPosition.load(id)
  if (!pos) {
    pos = new UserVaultPosition(id)
    pos.user = user
    pos.vault = vault.id
    pos.shares = BigInt.zero()
    pos.avgEntryTime = timestamp
    pos.points = BD_ZERO
    pos.indexSnapshot = vault.pointsIndex!
  }
  pos.points = pos.points.plus(pos.shares.toBigDecimal().times(vault.pointsIndex!.minus(pos.indexSnapshot)))
  pos.indexSnapshot = vault.pointsIndex!
  return pos
}

// Vault share Transfer. Shares leaving a wallet (withdrawal request to the strategy, transfer,
// burn) forfeit points; shares arriving (deposit, transfer, cancelled withdrawal) blend the entry time.
export function handleVaultShareTransfer(event: ShareTransfer): void {
  let ts = event.block.timestamp
  let vault = advancePointsIndex(event.address, ts)
  let strategy = ArcaVault.bind(event.address).try_getStrategy()
  let from = event.params.from
  let to = event.params.to
  let value = event.params.value
  let fromStrategy = !strategy.reverted && from.equals(strategy.value)

  if (!from.equals(ZERO_ADDRESS) && !fromStrategy) {
    let pos = settledPosition(vault, from, ts)
    if (pos.shares.gt(BigInt.zero())) {
      let taken = value.gt(pos.shares) ? pos.shares : value
      let fraction = taken.toBigDecimal().div(pos.shares.toBigDecimal())
      pos.points = pos.points.minus(pos.points.times(fraction).times(penaltyRate(ts.minus(pos.avgEntryTime))))
      pos.shares = pos.shares.minus(taken)
    }
    pos.save()
  }

  let toStrategy = !strategy.reverted && to.equals(strategy.value)
  if (!to.equals(ZERO_ADDRESS) && !toStrategy) {
    let pos = settledPosition(vault, to, ts)
    let total = pos.shares.plus(value)
    // A cancelled withdrawal returns shares without resetting their age
    if (!fromStrategy && total.gt(BigInt.zero())) {
      pos.avgEntryTime = pos.avgEntryTime.times(pos.shares).plus(ts.times(value)).div(total)
    }
    pos.shares = total
    pos.save()
  }
}

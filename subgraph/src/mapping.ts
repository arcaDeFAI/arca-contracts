import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { RewardForwarded } from "../generated/ShadowStrategyUSSDUSDC/ShadowStrategy"
import { Transfer } from "../generated/MetroToken/ERC20"
import { Vault, RewardEvent } from "../generated/schema"

export function handleRewardForwardedShadow(event: RewardForwarded): void {
  // Shadow Strategy Address
  let strategyAddress = event.address
  let vaultAddress = event.params.vault

  let vault = Vault.load(vaultAddress)
  if (!vault) {
    vault = new Vault(vaultAddress)
    vault.strategy = strategyAddress
    vault.protocol = "shadow"
    vault.save()
  }

  let rewardId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let reward = new RewardEvent(rewardId)
  reward.vault = vault.id
  reward.strategy = strategyAddress
  reward.rewardToken = event.params.token
  reward.amount = event.params.amount
  reward.timestamp = event.block.timestamp
  reward.blockNumber = event.block.number
  reward.txHash = event.transaction.hash
  reward.save()
}

// Metropolis Map (Strategy -> Vault)
export function getMetroVault(strategy: Bytes): Bytes {
  if (strategy.equals(Bytes.fromHexString("0x20302bc08CcaAFB039916e4a06f0B3917506019a"))) return Bytes.fromHexString("0xF5708969da13879d7A6D2F21d0411BF9eEB045E9")
  if (strategy.equals(Bytes.fromHexString("0x7069B87c64ee8DA6bF928B4Af0693bC7a4f9D7e6"))) return Bytes.fromHexString("0xBaef4Da824f554c35035211cb997db4ecB75F45f")
  if (strategy.equals(Bytes.fromHexString("0xeca4AE2D4778b1417d6cB47B9C7769e9f5fC4A3f"))) return Bytes.fromHexString("0x1C0C5A4197b7Fa25a180E6e08eA19A91EBBe5fD2")
  if (strategy.equals(Bytes.fromHexString("0x38FdF9a12Ac2e2aD95dd5bE3d271cC6EA23C5c2C"))) return Bytes.fromHexString("0x34331E66a634D69D64edC3e21E52A53899e12640")
  return Bytes.empty()
}

const METRO_TOKEN = Bytes.fromHexString("0x71e99522ead5e21cf57f1f542dc4ad2e841f7321")

export function handleMetroTransfer(event: Transfer): void {
  const strategy = event.params.from
  const vaultAddress = getMetroVault(strategy)

  // Verify this is a Transfer from a known Strategy to its specific Vault
  if (vaultAddress.length > 0 && event.params.to.equals(vaultAddress)) {
    let vault = Vault.load(vaultAddress)
    if (!vault) {
      vault = new Vault(vaultAddress)
      vault.strategy = strategy
      vault.protocol = "metropolis"
      vault.save()
    }

    let rewardId = event.transaction.hash.concatI32(event.logIndex.toI32())
    let reward = new RewardEvent(rewardId)
    reward.vault = vault.id
    reward.strategy = strategy
    reward.rewardToken = METRO_TOKEN
    reward.amount = event.params.value
    reward.timestamp = event.block.timestamp
    reward.blockNumber = event.block.number
    reward.txHash = event.transaction.hash
    reward.save()
  }
}

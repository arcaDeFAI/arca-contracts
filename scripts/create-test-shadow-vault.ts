/**
 * Creates a fresh Shadow vault for testing the rebalance swap.
 *
 * Why this exists: migrating an existing vault re-clones its strategy, which
 * calls withdrawAll() and moves real user funds. A brand new vault avoids all of
 * that — it starts empty, so nothing is at risk but what you deposit yourself.
 *
 * A new vault is cloned from whatever strategy implementation the factory holds
 * at creation time, so deploying the swap implementation first means the vault
 * is born with rebalanceWithSwap() and never needs migrating.
 *
 * Note that setting the implementation is a factory-wide change: it affects
 * every vault created afterwards. It does NOT touch existing vaults, whose
 * clones keep pointing at the old implementation until they are migrated.
 *
 * Usage:
 *   npx hardhat run scripts/create-test-shadow-vault.ts --network sonic-mainnet
 *
 * Env:
 *   DRY_RUN=1        read and report, send nothing
 *   DEPLOY_IMPL=1    deploy the swap-capable implementation and set it on the
 *                    factory first, so the new vault is created with swap support
 *   POOL=0x...       Ramses V3 pool (default: the wS/USDC pool)
 *   AUM_FEE=0        AUM annual fee in bps-scaled units (default 0 for a test vault)
 *   TWAP=300         TWAP interval in seconds (default 300, same as the live vault)
 *   OPERATOR=0x...   address allowed to rebalance (default: the deployer)
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import type { VaultFactory } from "../typechain-types";

/** wS/USDC Ramses V3 pool — the same pool the live Shadow vault uses. */
const DEFAULT_POOL = "0x324963c267C354c7660Ce8CA3F5f167E05649970";
const STRATEGY_TYPE_SHADOW = 2;

const DRY_RUN = process.env.DRY_RUN === "1";
const DEPLOY_IMPL = process.env.DEPLOY_IMPL === "1";
const POOL = process.env.POOL || DEFAULT_POOL;
const AUM_FEE = process.env.AUM_FEE ? Number(process.env.AUM_FEE) : 0;
const TWAP = process.env.TWAP ? Number(process.env.TWAP) : 300;
const OPERATOR = process.env.OPERATOR || null;

function loadDeployment(): { vaultFactory: string; shadowPriceHelper: string; shadowMaxRange: number } {
  const path = `./deployments/metropolis-${network.name}.json`;
  if (!fs.existsSync(path)) throw new Error(`Deployment file not found: ${path}`);
  const d = JSON.parse(fs.readFileSync(path, "utf-8"));
  if (!d.addresses?.vaultFactory) throw new Error("vaultFactory missing from deployment file");
  if (!d.addresses?.shadowPriceHelper) {
    throw new Error("shadowPriceHelper missing — ShadowStrategy links that library");
  }
  return {
    vaultFactory: d.addresses.vaultFactory,
    shadowPriceHelper: d.addresses.shadowPriceHelper,
    shadowMaxRange: d.configuration?.shadowMaxRange ?? 887272,
  };
}

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const cfg = loadDeployment();

  console.log("=".repeat(64));
  console.log("Create test Shadow vault");
  console.log("=".repeat(64));
  console.log("Network :", network.name);
  console.log("Signer  :", signer.address);
  console.log("Pool    :", POOL);
  console.log("AUM fee :", AUM_FEE);
  console.log("TWAP    :", TWAP, "s");
  console.log("Mode    :", DRY_RUN ? "DRY RUN (nothing is sent)" : "LIVE");

  const factory = (await ethers.getContractAt(
    "VaultFactory",
    cfg.vaultFactory,
    signer,
  )) as unknown as VaultFactory;

  const owner = await factory.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer is not the factory owner (owner is ${owner}).`);
  }

  // ---- Preflight: every condition createMarketMakerShadowOracleRewardVault checks
  const whitelisted = await factory.isPairWhitelisted(POOL);
  const creationFee = await factory.getCreationFee();
  const pool = await ethers.getContractAt("IRamsesV3Pool", POOL);
  const slot0 = await pool.slot0();
  const cardinality = Number(slot0[2]);

  console.log("\nPreflight");
  console.log("  pool whitelisted   :", whitelisted);
  console.log("  creation fee       :", ethers.formatEther(creationFee), "S");
  console.log("  obs cardinality    :", cardinality, TWAP > 0 ? "(needs >= 10)" : "");
  console.log("  strategy impl      :", await factory.getStrategyImplementation(STRATEGY_TYPE_SHADOW));

  if (!whitelisted) throw new Error("Pool is not whitelisted — factory would revert");
  if (TWAP > 0 && cardinality < 10) {
    throw new Error(`Observation cardinality ${cardinality} < 10 — factory would revert`);
  }

  const before = Number(await factory.getNumberOfVaults(4));
  console.log("  shadow vaults now  :", before);

  if (DRY_RUN) {
    console.log("\nDry run — nothing sent.");
    return;
  }

  // ---- 1. Optionally put the swap-capable implementation on the factory ----
  let implementation = await factory.getStrategyImplementation(STRATEGY_TYPE_SHADOW);

  if (DEPLOY_IMPL) {
    console.log("\n[1/2] Deploying swap-capable ShadowStrategy implementation...");
    const Strategy = await ethers.getContractFactory("ShadowStrategy", {
      libraries: { ShadowPriceHelper: cfg.shadowPriceHelper },
      signer,
    });
    const impl = await Strategy.deploy(cfg.vaultFactory, cfg.shadowMaxRange);
    await impl.waitForDeployment();
    implementation = await impl.getAddress();
    console.log("      deployed at:", implementation);

    await (await factory.setStrategyImplementation(STRATEGY_TYPE_SHADOW, implementation)).wait();
    const confirmed = await factory.getStrategyImplementation(STRATEGY_TYPE_SHADOW);
    if (confirmed.toLowerCase() !== implementation.toLowerCase()) {
      throw new Error("Factory did not accept the new implementation");
    }
    console.log("      ✓ factory updated (affects new vaults only)");
  } else {
    console.log("\n[1/2] DEPLOY_IMPL not set — the new vault will use the implementation above.");
  }

  // ---- 2. Create the vault ------------------------------------------------
  console.log("\n[2/2] Creating vault...");
  const tx = await factory.createMarketMakerShadowOracleRewardVault(POOL, AUM_FEE, TWAP, {
    value: creationFee,
  });
  const receipt = await tx.wait();

  // The factory appends to its own list, so the newest entry is ours. Reading it
  // back is more robust than parsing logs across several event shapes.
  const after = Number(await factory.getNumberOfVaults(4));
  if (after !== before + 1) {
    throw new Error(`Expected ${before + 1} shadow vaults, factory reports ${after}`);
  }
  const vault = await factory.getVaultAt(4, after - 1);
  const vaultContract = await ethers.getContractAt("IOracleRewardShadowVault", vault);
  const strategy = await vaultContract.getStrategy();

  console.log("      vault    :", vault);
  console.log("      strategy :", strategy);
  console.log("      tx       :", receipt?.hash);

  // The factory sets the operator to the caller; point it elsewhere if asked.
  if (OPERATOR && OPERATOR.toLowerCase() !== signer.address.toLowerCase()) {
    await (await factory.setOperator(strategy, OPERATOR)).wait();
    console.log("      ✓ operator set to", OPERATOR);
  }

  // ---- Confirm the vault really has the swap entry point -------------------
  const swapCapable =
    (await ethers.provider.getCode(strategy)) !== "0x" &&
    (await ethers.getContractAt("IShadowStrategy", strategy)).interface.hasFunction(
      "rebalanceWithSwap",
    );
  console.log("\n  rebalanceWithSwap in ABI :", swapCapable);
  console.log(
    "  (this reflects the local ABI; confirm on-chain by calling rebalanceWithSwap once funded)",
  );

  const outPath = `./deployments/test-shadow-vault-${network.name}.json`;
  const record = {
    network: network.name,
    timestamp: new Date().toISOString(),
    deployer: signer.address,
    pool: POOL,
    vault,
    strategy,
    implementation,
    aumFee: AUM_FEE,
    twapInterval: TWAP,
    operator: OPERATOR || signer.address,
  };
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
  console.log(`\n💾 Saved to ${outPath}`);

  console.log("\nNext:");
  console.log("  1. Add the vault to the UI behind visibleTo so only you see it");
  console.log("  2. Deposit a small amount");
  console.log("  3. Rebalance with a swap and check the SwapExecuted event");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

/**
 * Batched ShadowStrategy migration.
 *
 * Strategies are ImmutableClones: the implementation address is burned into the
 * clone's bytecode, so shipping new strategy code means deploying a fresh
 * implementation and re-cloning one strategy per vault. The vaults themselves
 * are untouched — shares, balances and user history all survive.
 *
 * `vault.setStrategy()` (driven by factory.createAndLinkShadowStrategy) already
 * moves the funds atomically: it calls withdrawAll() on the old strategy, which
 * exits the position, settles the withdrawal queue and harvests rewards, then
 * transfers everything to the new strategy.
 *
 * What it does NOT carry over — and what this script replays — is the strategy's
 * own configuration, because a fresh clone starts from initialize():
 *   - AUM annual fee  -> 0            (management fees silently stop being charged)
 *   - rebalance cooldown -> 5 seconds
 *   - operator -> whoever called createAndLinkShadowStrategy (the factory owner)
 *
 * Usage:
 *   npx hardhat run scripts/migrate-shadow-strategy.ts --network sonic-mainnet
 *
 * Env:
 *   DRY_RUN=1            simulate, send nothing (default when unset is "0")
 *   VAULTS=0xA,0xB       only migrate these vaults (default: every Shadow vault)
 *   COOLDOWN=300         rebalance cooldown to set on the new strategies, seconds.
 *                        ShadowStrategy exposes no getter for the current value,
 *                        so it cannot be read back — pass it explicitly or the
 *                        clone keeps initialize()'s 5 seconds.
 *   SKIP_IMPL=1          reuse the implementation already set on the factory
 *   DEPLOYMENT=<network> read addresses from deployments/metropolis-<network>.json
 *                        instead of the live network's own file. Needed on a fork,
 *                        which carries mainnet state but has no deployment file.
 *   IMPERSONATE=0x...    run as this address without its key. Fork/local only —
 *                        refused on any chain other than 31337.
 */

import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import type { VaultFactory } from "../typechain-types";

const VAULT_TYPE_SHADOW_ORACLE_REWARD = 4;
const STRATEGY_TYPE_SHADOW = 2;
/** Mirrors ShadowStrategy._MAX_AUM_ANNUAL_FEE (0.3e4 = 30%) */
const MAX_AUM_ANNUAL_FEE = 3000;

const DRY_RUN = process.env.DRY_RUN === "1";
const SKIP_IMPL = process.env.SKIP_IMPL === "1";
const COOLDOWN = process.env.COOLDOWN ? Number(process.env.COOLDOWN) : null;
const DEPLOYMENT_NAME = process.env.DEPLOYMENT || network.name;
const IMPERSONATE = process.env.IMPERSONATE || null;
const ONLY_VAULTS = process.env.VAULTS
  ? process.env.VAULTS.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean)
  : null;

interface DeploymentAddresses {
  vaultFactory: string;
  shadowPriceHelper: string;
  shadowMaxRange: number;
}

interface VaultPlan {
  vault: string;
  label: string;
  pool: string;
  tokenX: string;
  tokenY: string;
  oldStrategy: string;
  operator: string;
  aumAnnualFee: bigint;
  newStrategy?: string;
}

function loadDeployment(): DeploymentAddresses {
  const path = `./deployments/metropolis-${DEPLOYMENT_NAME}.json`;
  if (!fs.existsSync(path)) {
    throw new Error(`Deployment file not found: ${path}`);
  }
  const d = JSON.parse(fs.readFileSync(path, "utf-8"));
  const vaultFactory: string = d.addresses?.vaultFactory;
  const shadowPriceHelper: string = d.addresses?.shadowPriceHelper;

  if (!vaultFactory) throw new Error("vaultFactory missing from deployment file");
  if (!shadowPriceHelper) {
    // ShadowStrategy links this library for the swap slippage guard. Without it
    // the implementation cannot even be deployed, so fail loudly and early.
    throw new Error(
      "shadowPriceHelper missing from deployment file. ShadowStrategy links that " +
        "library and cannot be deployed without it.",
    );
  }
  return {
    vaultFactory,
    shadowPriceHelper,
    shadowMaxRange: d.configuration?.shadowMaxRange ?? 887272,
  };
}

async function tokenSymbol(address: string): Promise<string> {
  try {
    const erc20 = await ethers.getContractAt("MockERC20", address);
    return await erc20.symbol();
  } catch {
    return address.slice(0, 8);
  }
}

/** Read everything that will be lost when the vault is pointed at a new clone. */
async function buildPlan(factory: VaultFactory): Promise<VaultPlan[]> {
  const plans: VaultPlan[] = [];
  const count = await factory.getNumberOfVaults(VAULT_TYPE_SHADOW_ORACLE_REWARD);
  console.log(`\nShadow vaults registered in factory: ${count}`);

  for (let i = 0; i < Number(count); i++) {
    const vaultAddress = await factory.getVaultAt(VAULT_TYPE_SHADOW_ORACLE_REWARD, i);

    if (ONLY_VAULTS && !ONLY_VAULTS.includes(vaultAddress.toLowerCase())) continue;

    const vault = await ethers.getContractAt("IOracleRewardShadowVault", vaultAddress);
    const oldStrategy = await vault.getStrategy();

    if (oldStrategy === ethers.ZeroAddress) {
      console.warn(`⚠️  ${vaultAddress} has no strategy (emergency mode?) — skipped`);
      continue;
    }

    const strategy = await ethers.getContractAt("IShadowStrategy", oldStrategy);
    const [tokenX, tokenY, pool, operator, aumAnnualFee] = await Promise.all([
      vault.getTokenX(),
      vault.getTokenY(),
      vault.getPool(),
      strategy.getOperator(),
      strategy.getAumAnnualFee(),
    ]);

    plans.push({
      vault: vaultAddress,
      label: `${await tokenSymbol(tokenX)}-${await tokenSymbol(tokenY)}`,
      pool,
      tokenX,
      tokenY,
      oldStrategy,
      operator,
      aumAnnualFee,
    });
  }
  return plans;
}

async function main(): Promise<void> {
  const cfg = loadDeployment();

  let signer = (await ethers.getSigners())[0];

  if (IMPERSONATE) {
    // Only ever on a local fork: impersonation is a node feature, and running it
    // against a real chain would silently do nothing useful.
    const chainId = Number((await ethers.provider.getNetwork()).chainId);
    if (chainId !== 31337) {
      throw new Error(`IMPERSONATE is fork-only, refusing on chainId ${chainId}`);
    }
    await ethers.provider.send("hardhat_impersonateAccount", [IMPERSONATE]);
    await ethers.provider.send("hardhat_setBalance", [
      IMPERSONATE,
      "0x21e19e0c9bab2400000", // 10_000 ether, for gas
    ]);
    signer = await ethers.getSigner(IMPERSONATE);
    console.log("⚠️  IMPERSONATING", IMPERSONATE, "(fork only)");
  }

  console.log("=".repeat(64));
  console.log("ShadowStrategy migration");
  console.log("=".repeat(64));
  console.log("Network   :", network.name);
  console.log("Signer    :", signer.address);
  console.log("Factory   :", cfg.vaultFactory);
  console.log("PriceHelper:", cfg.shadowPriceHelper);
  console.log("Mode      :", DRY_RUN ? "DRY RUN (nothing is sent)" : "LIVE");

  const factory = (await ethers.getContractAt(
    "VaultFactory",
    cfg.vaultFactory,
    signer,
  )) as unknown as VaultFactory;

  const owner = await factory.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer is not the factory owner (owner is ${owner}). ` +
        "Migration requires the owner account.",
    );
  }

  // ---- Snapshot the settings a fresh clone would lose -----------------------
  const plans = await buildPlan(factory);
  if (plans.length === 0) {
    console.log("\nNothing to migrate.");
    return;
  }

  console.log("\nPlanned migrations:");
  for (const p of plans) {
    console.log(`\n  ${p.label}  (${p.vault})`);
    console.log(`    current strategy : ${p.oldStrategy}`);
    console.log(`    operator         : ${p.operator}`);
    console.log(`    AUM annual fee   : ${p.aumAnnualFee} bps-scaled`);
    if (p.aumAnnualFee > BigInt(MAX_AUM_ANNUAL_FEE)) {
      throw new Error(
        `${p.label}: AUM fee ${p.aumAnnualFee} exceeds the ${MAX_AUM_ANNUAL_FEE} cap — refusing to replay it`,
      );
    }
  }
  if (COOLDOWN === null) {
    console.log(
      "\n⚠️  COOLDOWN not set. New strategies keep initialize()'s 5 seconds.\n" +
        "    ShadowStrategy has no cooldown getter, so the current value cannot be read back.",
    );
  }

  // ---- 1. New implementation ----------------------------------------------
  let implementation: string = await factory.getStrategyImplementation(STRATEGY_TYPE_SHADOW);

  if (!SKIP_IMPL) {
    console.log("\n[1/3] Deploying ShadowStrategy implementation...");
    if (DRY_RUN) {
      console.log("      (dry run — skipped)");
    } else {
      const Strategy = await ethers.getContractFactory("ShadowStrategy", {
        libraries: { ShadowPriceHelper: cfg.shadowPriceHelper },
        signer,
      });
      const args: [string, number] = [cfg.vaultFactory, cfg.shadowMaxRange];
      const impl = await Strategy.deploy(...args);
      await impl.waitForDeployment();
      implementation = await impl.getAddress();
      console.log("      deployed at:", implementation);

      console.log("      setting factory implementation...");
      await (await factory.setStrategyImplementation(STRATEGY_TYPE_SHADOW, implementation)).wait();

      const confirmed = await factory.getStrategyImplementation(STRATEGY_TYPE_SHADOW);
      if (confirmed.toLowerCase() !== implementation.toLowerCase()) {
        throw new Error("Factory did not accept the new implementation");
      }
      console.log("      ✓ factory updated");

      try {
        await run("verify:verify", {
          address: implementation,
          constructorArguments: args,
          contract: "contracts-shadow/src/ShadowStrategy.sol:ShadowStrategy",
          libraries: { ShadowPriceHelper: cfg.shadowPriceHelper },
        });
        console.log("      ✓ verified");
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
        console.log(
          msg.includes("already verified")
            ? "      ✓ already verified"
            : `      ⚠️  verification failed (non-fatal): ${msg.slice(0, 120)}`,
        );
      }
    }
  } else {
    console.log("\n[1/3] SKIP_IMPL set — reusing implementation:", implementation);
  }

  // ---- 2. Re-clone + relink, one vault at a time ---------------------------
  console.log("\n[2/3] Migrating vaults...");
  for (const p of plans) {
    console.log(`\n  → ${p.label}`);
    if (DRY_RUN) {
      console.log("    (dry run — skipped)");
      continue;
    }

    await (
      await factory.createAndLinkShadowStrategy(p.vault, p.pool, p.tokenX, p.tokenY)
    ).wait();

    const vault = await ethers.getContractAt("IOracleRewardShadowVault", p.vault);
    p.newStrategy = await vault.getStrategy();

    if (p.newStrategy.toLowerCase() === p.oldStrategy.toLowerCase()) {
      throw new Error(`${p.label}: strategy did not change — aborting before replaying settings`);
    }
    console.log("    new strategy:", p.newStrategy);

    // ---- 3. Replay what the fresh clone lost ------------------------------
    // Order matters: set the operator last so the bot never sees a strategy it
    // controls but that still has a zero fee configured.
    if (p.aumAnnualFee > 0n) {
      await (await factory.setPendingAumAnnualFee(p.vault, Number(p.aumAnnualFee))).wait();
      console.log(`    ✓ AUM fee queued: ${p.aumAnnualFee} (applies at next rebalance)`);
    } else {
      console.log("    · AUM fee was 0, nothing to replay");
    }

    if (COOLDOWN !== null) {
      await (await factory.setRebalanceCoolDown(p.newStrategy, COOLDOWN)).wait();
      console.log(`    ✓ cooldown set: ${COOLDOWN}s`);
    }

    const strategy = await ethers.getContractAt("IShadowStrategy", p.newStrategy);
    if ((await strategy.getOperator()).toLowerCase() !== p.operator.toLowerCase()) {
      await (await factory.setOperator(p.newStrategy, p.operator)).wait();
      console.log("    ✓ operator restored:", p.operator);
    } else {
      console.log("    · operator already correct");
    }
  }

  // ---- Record -------------------------------------------------------------
  console.log("\n[3/3] Summary");
  for (const p of plans) {
    console.log(`  ${p.label}: ${p.oldStrategy} → ${p.newStrategy ?? "(dry run)"}`);
  }

  if (!DRY_RUN) {
    const out = {
      network: network.name,
      timestamp: new Date().toISOString(),
      deployer: signer.address,
      shadowStrategyImplementation: implementation,
      migrations: plans.map((p) => ({
        vault: p.vault,
        label: p.label,
        oldStrategy: p.oldStrategy,
        newStrategy: p.newStrategy,
        operator: p.operator,
        aumAnnualFee: p.aumAnnualFee.toString(),
        rebalanceCoolDown: COOLDOWN,
      })),
    };
    const path = `./deployments/shadow-strategy-migration-${network.name}.json`;
    fs.writeFileSync(path, JSON.stringify(out, null, 2));
    console.log(`\n💾 Saved to ${path}`);

    console.log(
      "\n⚠️  Each migrated vault is now out of position until its next rebalance.\n" +
        "    The AUM fee is queued and takes effect on that same rebalance.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

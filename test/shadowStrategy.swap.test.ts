import { expect } from "chai";
import { ethers, network } from "hardhat";
import type { Contract, Signer } from "ethers";

/**
 * Tests for the ratio swap add-on in ShadowStrategy.rebalanceWithSwap().
 *
 * Uses a REAL RamsesV3Pool (deployed through the real RamsesV3Factory and
 * RamsesV3PoolDeployer) seeded with liquidity, the real OracleRewardShadowVault
 * and the real ShadowStrategy deployed as immutable-args clones, exactly like
 * production. Only the VaultFactory is mocked.
 *
 * rebalance() keeps its original 6-parameter signature. rebalanceWithSwap()
 * adds:
 * - swapAmountIn:     > 0 swaps that amount of token X to Y, < 0 swaps Y to X,
 *                     0 behaves exactly like rebalance()
 * - minSwapAmountOut: operator-provided lower bound for the swap output
 * On top of minSwapAmountOut the strategy enforces a guard against the pool
 * oracle price (the vault TWAP window) with a fixed 3% max deviation.
 */
describe("ShadowStrategy rebalanceWithSwap", function () {
  const SQRT_PRICE_1_X96 = 2n ** 96n; // price 1:1
  const TICK_SPACING = 10n;
  const POOL_FEE_HUNDREDTHS_BIP = 500n; // 0.05% for tick spacing 10
  const FEE_DENOMINATOR = 1_000_000n;
  const FULL_RANGE_LOWER = -887270; // aligned to tick spacing 10
  const FULL_RANGE_UPPER = 887270;
  const SEED_LIQUIDITY = 10n ** 23n;
  const MAX_SWAP_SLIPPAGE_BPS = 300n; // _MAX_SWAP_SLIPPAGE_BPS in the contract

  let deployer: Signer;
  let outsider: Signer;
  let tokenX: Contract;
  let tokenY: Contract;
  let pool: Contract;
  let callee: Contract;
  let vault: Contract;
  let strategy: Contract;
  let strategyAddress: string;

  async function deployStack(): Promise<void> {
    [deployer, outsider] = await ethers.getSigners();
    const deployerAddr = await deployer.getAddress();

    // --- Tokens, sorted so that tokenX is token0 (as VaultFactory enforces)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    let a = await MockERC20.deploy("Token A", "TA", 18, deployerAddr);
    let b = await MockERC20.deploy("Token B", "TB", 18, deployerAddr);
    if (
      (await a.getAddress()).toLowerCase() >
      (await b.getAddress()).toLowerCase()
    ) {
      [a, b] = [b, a];
    }
    tokenX = a;
    tokenY = b;

    // --- Real Ramses V3 stack: factory -> pool deployer -> pool
    const oracleLib = await (
      await ethers.getContractFactory("Oracle")
    ).deploy();
    const positionLib = await (
      await ethers.getContractFactory("Position", {
        libraries: { Oracle: await oracleLib.getAddress() },
      })
    ).deploy();
    const protocolActionsLib = await (
      await ethers.getContractFactory("ProtocolActions")
    ).deploy();
    const poolLibraries = {
      Oracle: await oracleLib.getAddress(),
      Position: await positionLib.getAddress(),
      ProtocolActions: await protocolActionsLib.getAddress(),
    };

    const RamsesFactory = await ethers.getContractFactory("RamsesV3Factory");
    const ramsesFactory = await RamsesFactory.deploy(deployerAddr);
    const PoolDeployer = await ethers.getContractFactory(
      "RamsesV3PoolDeployer",
      { libraries: poolLibraries }
    );
    const poolDeployer = await PoolDeployer.deploy(
      await ramsesFactory.getAddress()
    );
    await ramsesFactory.initialize(await poolDeployer.getAddress());
    await ramsesFactory.createPool(
      await tokenX.getAddress(),
      await tokenY.getAddress(),
      TICK_SPACING,
      SQRT_PRICE_1_X96
    );
    const poolAddress = await ramsesFactory.getPool(
      await tokenX.getAddress(),
      await tokenY.getAddress(),
      TICK_SPACING
    );
    pool = await ethers.getContractAt("RamsesV3Pool", poolAddress);

    // --- Seed pool liquidity through the canonical test callee
    const Callee = await ethers.getContractFactory("TestRamsesV3Callee");
    callee = await Callee.deploy();
    await tokenX.approve(await callee.getAddress(), ethers.MaxUint256);
    await tokenY.approve(await callee.getAddress(), ethers.MaxUint256);
    await callee.mint(
      poolAddress,
      deployerAddr,
      0,
      FULL_RANGE_LOWER,
      FULL_RANGE_UPPER,
      SEED_LIQUIDITY
    );

    // --- Arca stack: mock VaultFactory, real vault + strategy clones
    const MockFactory = await ethers.getContractFactory("MockVaultFactoryLite");
    const factory = await MockFactory.deploy(deployerAddr);

    const PriceHelper = await ethers.getContractFactory("ShadowPriceHelper");
    const priceHelperAddress = await (await PriceHelper.deploy()).getAddress();

    const Vault = await ethers.getContractFactory("OracleRewardShadowVault", {
      libraries: { ShadowPriceHelper: priceHelperAddress },
    });
    const vaultImplementation = await Vault.deploy(await factory.getAddress());

    const Strategy = await ethers.getContractFactory("ShadowStrategy", {
      libraries: { ShadowPriceHelper: priceHelperAddress },
    });
    const strategyImplementation = await Strategy.deploy(
      await factory.getAddress(),
      1_774_540 // max range in ticks
    );

    const cloner = await (
      await ethers.getContractFactory("TestCloneDeployer")
    ).deploy();

    const vaultData = ethers.solidityPacked(
      ["address", "address", "address", "uint8", "uint8"],
      [
        poolAddress,
        await tokenX.getAddress(),
        await tokenY.getAddress(),
        18,
        18,
      ]
    );
    const vaultAddress = await cloner.cloneDeterministic.staticCall(
      await vaultImplementation.getAddress(),
      vaultData,
      ethers.id("swap-test-vault")
    );
    await cloner.cloneDeterministic(
      await vaultImplementation.getAddress(),
      vaultData,
      ethers.id("swap-test-vault")
    );
    vault = await ethers.getContractAt("OracleRewardShadowVault", vaultAddress);
    await vault.initialize("Arca Swap Test Vault", "ASTV");

    const strategyData = ethers.solidityPacked(
      ["address", "address", "address", "address"],
      [
        vaultAddress,
        poolAddress,
        await tokenX.getAddress(),
        await tokenY.getAddress(),
      ]
    );
    strategyAddress = await cloner.cloneDeterministic.staticCall(
      await strategyImplementation.getAddress(),
      strategyData,
      ethers.id("swap-test-strategy")
    );
    await cloner.cloneDeterministic(
      await strategyImplementation.getAddress(),
      strategyData,
      ethers.id("swap-test-strategy")
    );
    strategy = await ethers.getContractAt("ShadowStrategy", strategyAddress);
    await strategy.initialize();

    await factory.callSetStrategy(vaultAddress, strategyAddress);

    // Idle reserves held by the strategy, as after a partial position entry
    await tokenX.transfer(strategyAddress, ethers.parseEther("1000"));
    await tokenY.transfer(strategyAddress, ethers.parseEther("1000"));
  }

  async function increaseTime(seconds: number): Promise<void> {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine", []);
  }

  /**
   * Tick range is valid but both deposit amounts are zero, so the position
   * entry aborts AFTER the swap. That isolates the swap leg of the rebalance.
   */
  function rebalanceSwapping(swapAmountIn: bigint, minOut: bigint) {
    return strategy.rebalanceWithSwap(0, 10, 0, 0, 0, 0, swapAmountIn, minOut);
  }

  async function swapEventFrom(tx: {
    wait: () => Promise<{ logs: ReadonlyArray<unknown> } | null>;
  }): Promise<{ xToY: boolean; amountIn: bigint; amountOut: bigint }> {
    const receipt = await tx.wait();
    const parsed = receipt!.logs
      .map((log) => {
        try {
          return strategy.interface.parseLog(
            log as { topics: string[]; data: string }
          );
        } catch {
          return null;
        }
      })
      .find((entry) => entry?.name === "SwapExecuted");
    expect(parsed, "SwapExecuted event missing").to.not.equal(undefined);
    return {
      xToY: parsed!.args.xToY as boolean,
      amountIn: parsed!.args.amountIn as bigint,
      amountOut: parsed!.args.amountOut as bigint,
    };
  }

  beforeEach(async function () {
    await deployStack();
  });

  it("swaps Y to X during rebalance with exact balance accounting", async function () {
    const amountIn = ethers.parseEther("100");
    const xBefore = await tokenX.balanceOf(strategyAddress);
    const yBefore = await tokenY.balanceOf(strategyAddress);

    // swapAmountIn < 0 => swap Y for X
    const event = await swapEventFrom(await rebalanceSwapping(-amountIn, 1n));

    expect(event.xToY).to.equal(false);
    expect(event.amountIn).to.equal(amountIn);

    // Exact balance conservation against the event
    expect(await tokenY.balanceOf(strategyAddress)).to.equal(
      yBefore - amountIn
    );
    expect(await tokenX.balanceOf(strategyAddress)).to.equal(
      xBefore + event.amountOut
    );

    // At a 1:1 price the output is bounded above by the input minus the pool
    // fee, and below by the 3% oracle guard the contract enforces
    const feeCeiling =
      amountIn - (amountIn * POOL_FEE_HUNDREDTHS_BIP) / FEE_DENOMINATOR;
    expect(event.amountOut).to.be.lessThanOrEqual(feeCeiling);
    expect(event.amountOut).to.be.greaterThanOrEqual(
      (amountIn * (10_000n - MAX_SWAP_SLIPPAGE_BPS)) / 10_000n
    );
  });

  it("swaps X to Y with a positive swapAmountIn", async function () {
    const amountIn = ethers.parseEther("50");
    const xBefore = await tokenX.balanceOf(strategyAddress);
    const yBefore = await tokenY.balanceOf(strategyAddress);

    const event = await swapEventFrom(await rebalanceSwapping(amountIn, 1n));

    expect(event.xToY).to.equal(true);
    expect(event.amountIn).to.equal(amountIn);
    expect(await tokenX.balanceOf(strategyAddress)).to.equal(
      xBefore - amountIn
    );
    expect(await tokenY.balanceOf(strategyAddress)).to.equal(
      yBefore + event.amountOut
    );
  });

  it("reverts the whole rebalance when the oracle slippage guard trips", async function () {
    // Large enough relative to pool liquidity to move the price past the 3%
    // guard: dSqrtP = amountIn / L = 1e22 / 1e23 = 0.1 => ~21% price move
    const hugeAmount = ethers.parseEther("10000");
    await tokenY.transfer(strategyAddress, hugeAmount);

    const xBefore = await tokenX.balanceOf(strategyAddress);
    const yBefore = await tokenY.balanceOf(strategyAddress);
    const positionBefore = await strategy.getPosition();

    await expect(
      rebalanceSwapping(-hugeAmount, 1n)
    ).to.be.revertedWithCustomError(strategy, "Strategy__SwapSlippage");

    // Whole rebalance rolled back, position untouched
    expect(await tokenX.balanceOf(strategyAddress)).to.equal(xBefore);
    expect(await tokenY.balanceOf(strategyAddress)).to.equal(yBefore);
    expect(await strategy.getPosition()).to.deep.equal(positionBefore);
  });

  it("reverts when minSwapAmountOut is not met", async function () {
    const amountIn = ethers.parseEther("100");
    // Impossible bound: more out than in at a 1:1 price
    await expect(
      rebalanceSwapping(-amountIn, amountIn + 1n)
    ).to.be.revertedWithCustomError(strategy, "Strategy__SwapSlippage");
  });

  it("rejects a swap with no minSwapAmountOut", async function () {
    await expect(
      rebalanceSwapping(-ethers.parseEther("1"), 0n)
    ).to.be.revertedWithCustomError(strategy, "Strategy__ZeroAmounts");
  });

  it("uses the vault TWAP window as the reference price when configured", async function () {
    await pool.increaseObservationCardinalityNext(10);
    // Write an observation, then let time pass so a 60s TWAP is available
    await callee.swapExact1For0(
      await pool.getAddress(),
      ethers.parseEther("1"),
      await deployer.getAddress(),
      SQRT_PRICE_1_X96 * 2n
    );
    await increaseTime(120);

    await vault.setTwapInterval(60);
    expect(await vault.getTwapInterval()).to.equal(60n);

    const amountIn = ethers.parseEther("10");
    const yBefore = await tokenY.balanceOf(strategyAddress);

    const event = await swapEventFrom(await rebalanceSwapping(-amountIn, 1n));

    expect(event.amountIn).to.equal(amountIn);
    expect(await tokenY.balanceOf(strategyAddress)).to.equal(
      yBefore - amountIn
    );
  });

  it("does not swap when swapAmountIn is zero", async function () {
    const xBefore = await tokenX.balanceOf(strategyAddress);
    const yBefore = await tokenY.balanceOf(strategyAddress);

    const receipt = await (await rebalanceSwapping(0n, 0n)).wait();
    const swapTopic = strategy.interface.getEvent("SwapExecuted")!.topicHash;
    const swapEvents = receipt!.logs.filter(
      (log: { topics: ReadonlyArray<string> }) => log.topics[0] === swapTopic
    );

    expect(swapEvents.length).to.equal(0);
    expect(await tokenX.balanceOf(strategyAddress)).to.equal(xBefore);
    expect(await tokenY.balanceOf(strategyAddress)).to.equal(yBefore);
  });

  it("leaves the original rebalance() signature swap-free", async function () {
    const xBefore = await tokenX.balanceOf(strategyAddress);
    const yBefore = await tokenY.balanceOf(strategyAddress);

    const receipt = await (await strategy.rebalance(0, 10, 0, 0, 0, 0)).wait();
    const swapTopic = strategy.interface.getEvent("SwapExecuted")!.topicHash;

    expect(
      receipt!.logs.filter(
        (log: { topics: ReadonlyArray<string> }) => log.topics[0] === swapTopic
      ).length
    ).to.equal(0);
    expect(await tokenX.balanceOf(strategyAddress)).to.equal(xBefore);
    expect(await tokenY.balanceOf(strategyAddress)).to.equal(yBefore);
  });

  it("rejects rebalanceWithSwap from non-operators", async function () {
    await expect(
      strategy
        .connect(outsider)
        .rebalanceWithSwap(0, 10, 0, 0, 0, 0, ethers.parseEther("1"), 1n)
    ).to.be.revertedWithCustomError(strategy, "Strategy__OnlyOperators");
  });

  it("rejects swap callbacks from anyone but the pool", async function () {
    await expect(
      strategy.uniswapV3SwapCallback(1, 1, "0x")
    ).to.be.revertedWithCustomError(strategy, "Strategy__InvalidCallback");
  });
});

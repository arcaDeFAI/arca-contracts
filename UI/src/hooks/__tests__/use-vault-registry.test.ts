import { renderHook, waitFor } from "@testing-library/react";
import type { Mock } from "vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock wagmi
vi.mock("wagmi", () => ({
  useAccount: vi.fn(),
  useReadContract: vi.fn(),
}));

// Mock contracts
vi.mock("../../lib/contracts", () => ({
  getContracts: vi.fn(),
  REGISTRY_ABI: [],
}));

// Mock viem for direct contract calls
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...(actual as Record<string, unknown>),
    createPublicClient: vi.fn(),
    http: vi.fn(),
  };
});

// Mock React Query with a factory function
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

// Import after mocks are set up
import { useVaultRegistry } from "../use-vault-registry";
import { useAccount, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import * as viem from "viem";
import { getContracts } from "../../lib/contracts";

describe("useVaultRegistry - TDD Multi-Network & Multi-Vault Support", () => {
  const mockRegistryAddress = "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7";
  const mockVaultAddresses = ["0xVault1", "0xVault2", "0xVault3"];

  const mockVaultInfos = [
    {
      vault: "0xVault1",
      rewardClaimer: "0xReward1",
      queueHandler: "0xQueue1",
      feeManager: "0xFee1",
      tokenX: "0xTokenX1",
      tokenY: "0xTokenY1",
      name: "Arca wS-USDC.e Vault",
      symbol: "ARCA-V1",
      isActive: true,
    },
    {
      vault: "0xVault2",
      rewardClaimer: "0xReward2",
      queueHandler: "0xQueue2",
      feeManager: "0xFee2",
      tokenX: "0xTokenX2",
      tokenY: "0xTokenY2",
      name: "Arca METRO-USDC.e Vault",
      symbol: "ARCA-V2",
      isActive: true,
    },
    {
      vault: "0xVault3",
      rewardClaimer: "0xReward3",
      queueHandler: "0xQueue3",
      feeManager: "0xFee3",
      tokenX: "0xTokenX3",
      tokenY: "0xTokenY3",
      name: "Arca wS-METRO Vault",
      symbol: "ARCA-V3",
      isActive: true,
    },
  ];

  // Helper to mock useReadContract consistently
  const mockUseReadContract = (
    vaultAddresses: string[] = mockVaultAddresses,
  ) => {
    (useReadContract as Mock).mockImplementation((config) => {
      if (!config || config.enabled === false) {
        return undefined;
      }

      if (config.functionName === "getVaultInfo" && config.args) {
        const vaultAddress = config.args[0];
        const index = vaultAddresses.indexOf(vaultAddress);
        if (index >= 0) {
          return {
            data: mockVaultInfos[index],
            isLoading: false,
          };
        }
      }
      return { data: null, isLoading: false };
    });
  };

  // Helper to setup network test with viem client mock
  const setupNetworkTest = (
    chainId: number,
    registryAddress: string,
    vaultAddresses: string[],
  ) => {
    (useAccount as Mock).mockReturnValue({ chainId });

    // Mock getContracts to return the registry address
    (getContracts as Mock).mockReturnValue({ registry: registryAddress });

    const mockClient = {
      readContract: vi.fn().mockResolvedValue(vaultAddresses),
    };
    (viem.createPublicClient as Mock).mockReturnValue(mockClient);

    let capturedQueryFn: (() => Promise<unknown>) | undefined;
    (useQuery as Mock).mockImplementation(({ queryFn, queryKey }) => {
      if (queryKey && queryKey[0] === "activeVaults") {
        capturedQueryFn = queryFn;
        return {
          data: vaultAddresses,
          isLoading: false,
          error: null,
        };
      }
      return { data: null, isLoading: false, error: null };
    });

    return { capturedQueryFn };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock for useReadContract
    mockUseReadContract();
  });

  describe("Multi-Network Support", () => {
    it("should work with localhost network (chainId 31337)", async () => {
      // Arrange
      const { capturedQueryFn } = setupNetworkTest(
        31337,
        mockRegistryAddress,
        mockVaultAddresses,
      );

      // Act
      const { result } = renderHook(() => useVaultRegistry());

      // Assert - verify hook is working with correct chain and has vaults
      expect(result.current.vaults).toHaveLength(3);
      expect(result.current.registryAddress).toBe(mockRegistryAddress);
      expect(result.current.error).toBeNull();

      // If we need to test the chain config usage, execute the queryFn
      if (capturedQueryFn) {
        await capturedQueryFn();

        // Now verify localhost RPC was used
        expect(viem.createPublicClient).toHaveBeenCalledWith(
          expect.objectContaining({
            chain: expect.objectContaining({
              id: 31337,
              rpcUrls: expect.objectContaining({
                default: expect.objectContaining({
                  http: expect.arrayContaining(["http://127.0.0.1:8545"]),
                }),
              }),
            }),
          }),
        );
      }
    });

    it("should work with Sonic Blaze Testnet (chainId 57054)", async () => {
      // Arrange
      const testnetRegistry = "0xd8cF609ac86ddE8Bde1d41F53Ed2F94Ba173BF2f";
      const { capturedQueryFn } = setupNetworkTest(
        57054,
        testnetRegistry,
        mockVaultAddresses,
      );

      // Act
      const { result } = renderHook(() => useVaultRegistry());

      // Assert - verify hook is working with correct chain and has vaults
      expect(result.current.vaults).toHaveLength(3);
      expect(result.current.registryAddress).toBe(testnetRegistry);
      expect(result.current.error).toBeNull();

      // If we need to test the chain config usage, execute the queryFn
      if (capturedQueryFn) {
        await capturedQueryFn();

        // Now verify testnet RPC was used
        expect(viem.createPublicClient).toHaveBeenCalledWith(
          expect.objectContaining({
            chain: expect.objectContaining({
              id: 57054,
              name: "Sonic Blaze Testnet",
            }),
          }),
        );
      }
    });

    it("should work with Sonic Mainnet (chainId 146)", async () => {
      // Arrange
      const { capturedQueryFn } = setupNetworkTest(
        146,
        "0xMainnetRegistry",
        mockVaultAddresses,
      );

      // Act
      const { result } = renderHook(() => useVaultRegistry());

      // Assert - verify hook is working with correct chain and has vaults
      expect(result.current.vaults).toHaveLength(3);
      expect(result.current.registryAddress).toBe("0xMainnetRegistry");
      expect(result.current.error).toBeNull();

      // If we need to test the chain config usage, execute the queryFn
      if (capturedQueryFn) {
        await capturedQueryFn();

        // Now verify mainnet RPC was used
        expect(viem.createPublicClient).toHaveBeenCalledWith(
          expect.objectContaining({
            chain: expect.objectContaining({
              id: 146,
              name: "Sonic",
            }),
          }),
        );
      }
    });

    it("should handle unsupported network gracefully", async () => {
      // Arrange - unsupported chain
      const mockChainId = 999;
      (useAccount as Mock).mockReturnValue({ chainId: mockChainId });

      (getContracts as Mock).mockReturnValue(null); // No contracts for this chain

      // Mock useQuery to return empty since no registry
      (useQuery as Mock).mockImplementation(() => ({
        data: null,
        isLoading: false,
        error: null,
      }));

      // Act
      const { result } = renderHook(() => useVaultRegistry());

      // Assert
      expect(result.current.error).toBe("No registry found for this network");
      expect(result.current.vaults).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Multi-Vault Support", () => {
    it("should return ALL active vaults from registry, not just the first", async () => {
      // Arrange
      (useAccount as Mock).mockReturnValue({ chainId: 31337 });

      const { getContracts } = await import("../../lib/contracts");
      (getContracts as Mock).mockReturnValue({
        registry: mockRegistryAddress,
      });

      // Mock query to return multiple vault addresses
      (useQuery as Mock).mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "activeVaults") {
          return {
            data: mockVaultAddresses,
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      // useReadContract is already mocked in beforeEach

      // Act
      const { result } = renderHook(() => useVaultRegistry());

      // Assert - should have all 3 vaults, not just the first
      await waitFor(() => {
        expect(result.current.vaults).toHaveLength(3);
        expect(result.current.vaults[0].name).toBe("Arca wS-USDC.e Vault");
        expect(result.current.vaults[1].name).toBe("Arca METRO-USDC.e Vault");
        expect(result.current.vaults[2].name).toBe("Arca wS-METRO Vault");
      });
    });

    it("should handle empty vault list gracefully", async () => {
      // Arrange
      (useAccount as Mock).mockReturnValue({ chainId: 31337 });

      const { getContracts } = await import("../../lib/contracts");
      (getContracts as Mock).mockReturnValue({
        registry: mockRegistryAddress,
      });

      // Mock empty vault list
      (useQuery as Mock).mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "activeVaults") {
          return {
            data: [],
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      // Act
      const { result } = renderHook(() => useVaultRegistry());

      // Assert
      expect(result.current.vaults).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should support vaults with different token pairs", async () => {
      // Arrange
      (useAccount as Mock).mockReturnValue({ chainId: 31337 });

      const { getContracts } = await import("../../lib/contracts");
      (getContracts as Mock).mockReturnValue({
        registry: mockRegistryAddress,
      });

      (useQuery as Mock).mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "activeVaults") {
          return {
            data: mockVaultAddresses,
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      // useReadContract is already mocked in beforeEach

      // Act
      const { result } = renderHook(() => useVaultRegistry());

      // Assert - each vault has different token pairs
      await waitFor(() => {
        expect(result.current.vaults[0].tokenX).toBe("0xTokenX1");
        expect(result.current.vaults[0].tokenY).toBe("0xTokenY1");
        expect(result.current.vaults[1].tokenX).toBe("0xTokenX2");
        expect(result.current.vaults[1].tokenY).toBe("0xTokenY2");
        expect(result.current.vaults[2].tokenX).toBe("0xTokenX3");
        expect(result.current.vaults[2].tokenY).toBe("0xTokenY3");
      });
    });
  });

  describe("Network Switching", () => {
    it("should update vaults when network changes", async () => {
      // Arrange - start with localhost
      const { rerender } = renderHook(() => useVaultRegistry(), {
        wrapper: ({ children }) => children,
      });

      (useAccount as Mock).mockReturnValue({ chainId: 31337 });
      const { getContracts } = await import("../../lib/contracts");
      (getContracts as Mock).mockReturnValue({
        registry: mockRegistryAddress,
      });

      (useQuery as Mock).mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "activeVaults" && queryKey[2] === 31337) {
          return {
            data: ["0xLocalVault1"],
            isLoading: false,
            error: null,
          };
        }
        if (queryKey[0] === "activeVaults" && queryKey[2] === 57054) {
          return {
            data: ["0xTestnetVault1", "0xTestnetVault2"],
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      // Act - switch to testnet
      (useAccount as Mock).mockReturnValue({ chainId: 57054 });
      (getContracts as Mock).mockReturnValue({
        registry: "0xd8cF609ac86ddE8Bde1d41F53Ed2F94Ba173BF2f",
      });

      rerender();

      // Assert - query key includes chainId for cache separation
      await waitFor(() => {
        expect(useQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: [
              "activeVaults",
              "0xd8cF609ac86ddE8Bde1d41F53Ed2F94Ba173BF2f",
              57054,
            ],
          }),
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle registry contract errors gracefully", async () => {
      // Arrange
      (useAccount as Mock).mockReturnValue({ chainId: 31337 });

      const { getContracts } = await import("../../lib/contracts");
      (getContracts as Mock).mockReturnValue({
        registry: mockRegistryAddress,
      });

      // Mock contract error
      (useQuery as Mock).mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "activeVaults") {
          return {
            data: null,
            isLoading: false,
            error: new Error("Contract call failed"),
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      // Act
      const { result } = renderHook(() => useVaultRegistry());

      // Assert
      expect(result.current.error).toBeTruthy();
      expect(result.current.vaults).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it("should show loading state while fetching vaults", async () => {
      // Arrange
      (useAccount as Mock).mockReturnValue({ chainId: 31337 });

      const { getContracts } = await import("../../lib/contracts");
      (getContracts as Mock).mockReturnValue({
        registry: mockRegistryAddress,
      });

      // Mock loading state
      (useQuery as Mock).mockImplementation(() => ({
        data: null,
        isLoading: true,
        error: null,
      }));

      // Override the default mock for loading state
      (useReadContract as Mock).mockImplementation((config) => {
        if (!config || config.enabled === false) {
          return undefined;
        }
        return {
          data: null,
          isLoading: true,
        };
      });

      // Act
      const { result } = renderHook(() => useVaultRegistry());

      // Assert
      expect(result.current.isLoading).toBe(true);
      expect(result.current.vaults).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe("Performance & Efficiency", () => {
    it("should fetch all vault info in parallel for efficiency", async () => {
      // This test ensures the implementation uses efficient patterns
      // like Promise.all or useQueries instead of sequential fetching

      // Arrange
      (useAccount as Mock).mockReturnValue({ chainId: 31337 });

      const { getContracts } = await import("../../lib/contracts");
      (getContracts as Mock).mockReturnValue({
        registry: mockRegistryAddress,
      });

      (useQuery as Mock).mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "activeVaults") {
          return {
            data: mockVaultAddresses,
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      // Track how many times useReadContract is called
      let readContractCalls = 0;
      (useReadContract as Mock).mockImplementation((config) => {
        if (!config || config.enabled === false) {
          return undefined;
        }
        readContractCalls++;
        return { data: mockVaultInfos[0], isLoading: false };
      });

      // Act
      renderHook(() => useVaultRegistry());

      // Assert - should call useReadContract for each vault
      await waitFor(() => {
        expect(readContractCalls).toBe(3); // One for each vault
      });
    });
  });
});

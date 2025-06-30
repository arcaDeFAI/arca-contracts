import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import type { Config } from "wagmi";
import { getSupportedChains } from "../config/chains";

const projectId: string =
  import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "your-project-id";

// Configure chains and providers using centralized chain configuration
export const rainbowkitConfig1: Config = getDefaultConfig({
  appName: "Arca",
  projectId: projectId,
  chains: getSupportedChains(),
  ssr: false,
});

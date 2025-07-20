import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { rainbowkitConfig } from "./lib/rainbowkit";
import App from "./App";
import "./index.css";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={rainbowkitConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider
        theme={darkTheme({
          accentColor: "#00FF88",
          accentColorForeground: "#000000",
          borderRadius: "medium",
          fontStack: "system",
        })}
      >
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>,
);

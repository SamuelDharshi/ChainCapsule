"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit";
import { ReactNode } from "react";

const queryClient = new QueryClient();

// createNetworkConfig builds properly typed network configurations
const { networkConfig } = createNetworkConfig({
  testnet: {
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet" as const,
  },
  mainnet: {
    url: process.env.NEXT_PUBLIC_TATUM_KEY
      ? "https://sui-mainnet.gateway.tatum.io"
      : "https://fullnode.mainnet.sui.io:443",
    network: "mainnet" as const,
  },
});

type NetworkKey = keyof typeof networkConfig;
const defaultNetwork = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as NetworkKey;

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork}>
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

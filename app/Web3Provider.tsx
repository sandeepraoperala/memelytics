// app/Web3Provider.tsx (new file)
"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import {
  mainnet,
  arbitrum,
  polygon,
  base,
  optimism,
} from "@reown/appkit/networks";

// Setup queryClient
const queryClient = new QueryClient();

// Get projectId from environment
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "your-project-id";

// Set the networks
const networks: any = [mainnet, arbitrum, polygon, base, optimism];

// Create metadata
const metadata = {
  name: "Memelytics",
  description: "Create and share memes on blockchain",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "https://memelytics.com",
  icons: ["/logo.png"],
};

// Create Ethers adapter
const ethersAdapter = new EthersAdapter();

// Create AppKit instance
createAppKit({
  adapters: [ethersAdapter],
  networks,
  metadata,
  projectId,
  features: {
    analytics: true,
    email: false,
    socials: [
      "google",
      "x",
      "github",
      "discord",
      "apple",
      "facebook",
      "farcaster",
    ],
    emailShowWallets: true,
  },
});

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

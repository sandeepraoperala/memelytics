// lib/auth.ts
"use client";

import { useRouter } from "next/navigation";
import { useAppKitAccount, useDisconnect } from "@reown/appkit/react";
import { useEffect } from "react";

export function useWalletAuth(redirectIfNotConnected: string = "/") {
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  useEffect(() => {
    if (!isConnected && window.location.pathname !== "/") {
      router.push(redirectIfNotConnected);
    }
  }, [isConnected, router, redirectIfNotConnected]);

  const ensureUser = async () => {
    if (!address) return null;
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address.toLowerCase() }),
      });
      if (!response.ok) {
        throw new Error("Failed to ensure user");
      }
      const { user } = await response.json();
      console.log(`Ensured user: ${user.walletAddress}`);
      return user;
    } catch (error) {
      console.error("Ensure user error:", error);
      return null;
    }
  };

  const disconnectWallet = async () => {
    await disconnect();
    router.push("/");
  };

  return { address, isConnected, ensureUser, disconnectWallet };
}

// app/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useWalletAuth } from "../lib/auth";
import { useAppKit } from "@reown/appkit/react";
import { AppKitButton } from "@reown/appkit/react";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const { isConnected, address, ensureUser, disconnectWallet } =
    useWalletAuth();
  const { open } = useAppKit();

  useEffect(() => {
    if (isConnected) {
      ensureUser();
    }
  }, [isConnected, ensureUser]);

  const handleCreateClick = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    await ensureUser();
    router.push("/create");
  };

  const handleMyMemesClick = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    await ensureUser();
    router.push("/my-memes");
  };

  if (!isConnected) {
    return (
      <main
        className="container"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div>
          <h1>Connect Wallet to Start Creating Memes</h1>
          <AppKitButton />
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header">
        <div className="left-header">
          <div
            className="logo"
            onClick={() => router.push("/")}
            style={{ cursor: "pointer" }}
          >
            <img src="/logo.png" alt="Memelytics logo" />
          </div>
          <div className="search-bar">
            <input type="text" placeholder="Search" />
          </div>
        </div>
        <div className="header-buttons">
          <button onClick={handleCreateClick}>CREATE</button>
          <button onClick={handleMyMemesClick}>MY MEMES</button>
          <div
            className="user-id"
            onClick={() => open()}
            style={{ cursor: "pointer" }}
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
          <button onClick={disconnectWallet} className="disconnect-btn">
            Disconnect
          </button>
        </div>
      </header>

      <div className="categories">
        <button>Bitcoin</button>
        <button>Ethereum</button>
        <button>Solana</button>
        <button>Abstract</button>
        <button>Doge</button>
        <button>Openledger</button>
        <button>Shib</button>
        <button>Pepe</button>
        <button>AI</button>
        <button>Defi</button>
      </div>

      <div className="trending-toggle">
        <h2>Trending Now</h2>
        <div className="toggle-bar">
          <button>Meme</button>
          <button className="selected">GIFs</button>
          <button>AI Meme</button>
        </div>
      </div>

      <section className="masonry-wrap">
        <div className="meme-grid">
          {Array.from({ length: 20 }, (_, i) => (
            <img key={i} src={`/${i + 1}.png`} alt={`meme ${i + 1}`} />
          ))}
        </div>
      </section>
    </main>
  );
}

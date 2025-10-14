// app/my-memes/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useWalletAuth } from "../../lib/auth";
import { useAppKit } from "@reown/appkit/react";
import { AppKitButton } from "@reown/appkit/react";
import Image from "next/image";

export default function MyMemesPage() {
  const { address, isConnected, ensureUser, disconnectWallet } =
    useWalletAuth("/");
  const { open } = useAppKit();
  const [memes, setMemes] = useState([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    fetchMemes();
  }, [address]);

  const fetchMemes = async () => {
    try {
      await ensureUser();
      const response = await fetch(`/api/memes/user/${address}`);
      if (response.ok) {
        const data = await response.json();
        setMemes(data);
        setError(null);
      } else {
        throw new Error("Failed to fetch memes");
      }
    } catch (error) {
      console.error("Fetch memes error:", error);
      setError("Error fetching memes");
    }
  };

  const downloadMeme = async (imageUrl: string, memeId: string) => {
    try {
      const a = document.createElement("a");
      a.href = imageUrl;
      a.download = "meme.png";
      a.click();

      await fetch(`/api/memes/update/${memeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download" }),
      });
      fetchMemes();
    } catch (error) {
      console.error("Download error:", error);
      setError("Error downloading meme");
    }
  };

  const shareMeme = async (imageUrl: string, memeId: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ url: imageUrl });
      } else {
        navigator.clipboard.writeText(imageUrl);
        alert("Link copied to clipboard!");
      }
      await fetch(`/api/memes/update/${memeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share" }),
      });
      fetchMemes();
    } catch (error) {
      console.error("Share error:", error);
      setError("Error sharing meme");
    }
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
          <h1>Connect Wallet to View Your Memes</h1>
          <AppKitButton />
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header">
        <div className="logo">
          <Image src="/logo.png" alt="logo" width={210} height={40} />
        </div>
        <div className="header-buttons">
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

      <div className="trending-toggle">
        <h2>My Created Memes</h2>
        {error && (
          <div
            className="error-message"
            style={{ color: "red", marginBottom: "10px" }}
          >
            {error}
          </div>
        )}
      </div>

      <section className="masonry-wrap">
        <div className="meme-grid">
          {memes.length === 0 && !error && <p>No memes found</p>}
          {memes.map((meme: any) => (
            <div key={meme._id} className="meme-item">
              <img src={meme.imageUrl} alt="My Meme" />
              <div className="meme-actions">
                <button onClick={() => downloadMeme(meme.imageUrl, meme._id)}>
                  Download
                </button>
                <button onClick={() => shareMeme(meme.imageUrl, meme._id)}>
                  Share
                </button>
                <span>Tags: {meme.tags.join(", ")}</span>
                <span>
                  Downloads: {meme.downloads} | Shares: {meme.shares}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

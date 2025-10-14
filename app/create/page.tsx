// app/create/page.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useWalletAuth } from "../../lib/auth";
import { useAppKit } from "@reown/appkit/react";
import { AppKitButton } from "@reown/appkit/react";

export default function CreatePage() {
  const router = useRouter();
  const { isConnected, address, ensureUser, disconnectWallet } =
    useWalletAuth("/");
  const { open } = useAppKit();

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
          <h1>Connect Wallet to Create Memes</h1>
          <AppKitButton />
        </div>
      </main>
    );
  }

  const templates = Array.from({ length: 20 }, (_, i) => `/${i + 1}.png`);

  const handleNavigation = async (type: string) => {
    if (type === "ai") {
      alert("AI Meme - Coming Soon!");
      return;
    }
    await ensureUser();
    router.push(`/generate?type=${type}`);
  };

  return (
    <main className="container">
      <header className="header">
        <div className="left-header">
          <div className="logo">
            <Image
              src="/logo.png"
              alt="Memelytics logo"
              width={80}
              height={80}
            />
          </div>
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

      <div className="options">
        <div
          className="option-card"
          onClick={() => handleNavigation("meme")}
          style={{ cursor: "pointer" }}
        >
          <Image src="/make.png" alt="Make a Meme" width={120} height={120} />
          <span>Make a Meme</span>
        </div>
        <div
          className="option-card"
          onClick={() => handleNavigation("gif")}
          style={{ cursor: "pointer" }}
        >
          <Image src="/gif.png" alt="Make a GIF" width={120} height={120} />
          <span>Make a GIF</span>
        </div>
        <div
          className="option-card"
          onClick={() => handleNavigation("ai")}
          style={{ cursor: "pointer" }}
        >
          <Image src="/meme.png" alt="AI Meme" width={120} height={120} />
          <span>AI Meme (Coming Soon)</span>
        </div>
      </div>

      <div className="templates">
        <h2>Top Used Template</h2>
        <div className="template-grid">
          {templates.map((src, i) => (
            <Image
              key={i}
              src={src}
              alt={`Template ${i + 1}`}
              width={200}
              height={200}
              onClick={async () => {
                await ensureUser();
                router.push(`/generate?type=meme&template=${src}`);
              }}
              style={{ cursor: "pointer", borderRadius: "8px" }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

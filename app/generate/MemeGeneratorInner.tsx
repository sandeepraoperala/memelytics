"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useWalletAuth } from "../../lib/auth";
import { useAppKit } from "@reown/appkit/react";
import { AppKitButton } from "@reown/appkit/react";
import CanvasEditor, {
  type CanvasEditorHandle,
} from "@/components/canvas-editor";

const categories = [
  "Bitcoin",
  "Ethereum",
  "Solana",
  "Abstract",
  "Doge",
  "Openledger",
  "Shib",
  "Pepe",
  "AI",
  "Defi",
  "Other",
];

export default function MemeGeneratorInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isConnected, address, ensureUser, disconnectWallet } =
    useWalletAuth("/");
  const { open } = useAppKit();
  const editorRef = useRef<CanvasEditorHandle>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [type, setType] = useState("meme");
  const [currentTemplate, setCurrentTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) return;
    const t = searchParams.get("type") || "meme";
    const temp = searchParams.get("template") || "";
    setType(t);
    setCurrentTemplate(temp);
    if (temp) {
      editorRef.current?.loadTemplate(temp);
    }
  }, [isConnected, searchParams]);

  const onTemplateUpload = () => {
    editorRef.current?.openBasePicker();
    if (!showTags) setShowTags(true);
  };

  const onAddImage = () => {
    editorRef.current?.setTool("image");
    editorRef.current?.openImagesPicker();
  };

  const onRotate = () => editorRef.current?.rotateBy(90);
  const onAddSpace = () => editorRef.current?.addSpace();
  const onText = () => {
    editorRef.current?.setTool("text");
    editorRef.current?.addText();
  };
  const onDraw = () => editorRef.current?.setTool("draw");
  const onUndo = () => editorRef.current?.undo();
  const onRedo = () => editorRef.current?.redo();

  const saveMeme = async () => {
    if (!address || !editorRef.current) {
      setError("Canvas or wallet not initialized");
      return;
    }
    await ensureUser();
    try {
      const dataUrl = editorRef.current.getDataURL("png");
      const response = await fetch("/api/memes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          dataUrl,
          type,
          tags: selectedTags,
        }),
      });
      if (response.ok) {
        alert("Meme Saved!");
        router.push("/my-memes");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save meme");
      }
    } catch (error) {
      console.error("Save meme error:", error);
      setError((error as Error).message || "Error saving meme");
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
          <h1>Connect Wallet to Generate Memes</h1>
          <AppKitButton />
        </div>
      </main>
    );
  }

  return (
    <div className="container">
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
      <main className="main">
        {error && (
          <div
            className="error-message"
            style={{ color: "red", marginBottom: "10px" }}
          >
            {error}
          </div>
        )}
        <h1 className="title">Meme Generator - {type.toUpperCase()}</h1>
        <div className="generator-container">
          <div className="canvas-area">
            <CanvasEditor controls="external" ref={editorRef} />
            <div className="toolbox">
              <button className="toolbox-button" onClick={onRotate}>
                <Image src="/rotate.png" alt="Rotate" width={25} height={25} />
                <span>Rotate</span>
              </button>
              <button className="toolbox-button" onClick={onAddSpace}>
                <Image
                  src="/space.png"
                  alt="Add Space"
                  width={25}
                  height={25}
                />
                <span>Add Space</span>
              </button>
              <button className="toolbox-button" onClick={onText}>
                <Image src="/text.png" alt="Text" width={25} height={25} />
                <span>Text</span>
              </button>
              <button className="toolbox-button" onClick={onDraw}>
                <Image src="/draw.png" alt="Draw" width={25} height={25} />
                <span>Draw</span>
              </button>
              <button className="toolbox-button" onClick={onAddImage}>
                <Image
                  src="/add-image.png"
                  alt="Add Image"
                  width={25}
                  height={25}
                />
                <span>Image</span>
              </button>
            </div>
            <div className="undo-btn">
              <button className="toolbox-button" onClick={onUndo}>
                <Image src="/undo.png" alt="Undo" width={20} height={20} />
                <span>Undo</span>
              </button>
            </div>
            <div className="redo-btn">
              <button className="toolbox-button" onClick={onRedo}>
                <Image src="/redo.png" alt="Redo" width={20} height={20} />
                <span>Redo</span>
              </button>
            </div>
          </div>
          <div className="side-panel">
            <div className="upload-search-container">
              <button className="upload-btn" onClick={onTemplateUpload}>
                Upload New Template
                <Image src="/upload.png" alt="Upload" width={20} height={20} />
              </button>
              <div className="or-divider">or</div>
              <div className="search-box">
                <input
                  type="text"
                  placeholder="search with AI (Coming Soon)"
                  disabled
                />
                <button disabled>🔍</button>
              </div>
            </div>
            {showTags && (
              <div className="tags-section">
                <h3>Select Tags</h3>
                <select
                  multiple
                  value={selectedTags}
                  onChange={(e) =>
                    setSelectedTags(
                      Array.from(
                        e.currentTarget.selectedOptions,
                        (opt) => opt.value
                      )
                    )
                  }
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button onClick={saveMeme} className="save-btn">
                  Save Meme
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

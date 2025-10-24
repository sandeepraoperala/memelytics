"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useWalletAuth } from "../../lib/auth";
import { useAppKit } from "@reown/appkit/react";
import { AppKitButton } from "@reown/appkit/react";
import CanvasEditor, {
  type CanvasEditorHandle,
} from "@/components/canvas-editor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [hasTemplate, setHasTemplate] = useState(false);
  const [type, setType] = useState("meme");
  const [currentTemplate, setCurrentTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<
    "none" | "rotate" | "text" | "draw" | "space" | "download" | "image"
  >("none");
  const [brushColor, setBrushColor] = useState<string>("#111111");
  const [brushSize, setBrushSize] = useState<number>(6);
  const [selectedText, setSelectedText] = useState<{
    id: string;
    text: string;
    size: number;
    color: string;
    font: string;
    rotationDeg?: number;
  } | null>(null);
  const [selectedImage, setSelectedImage] = useState<{
    id: string;
    w: number;
    h: number;
  } | null>(null);
  const [imageScalePct, setImageScalePct] = useState<number>(100);
  const [mainImageScale, setMainImageScale] = useState<number>(100);

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

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setBrushColor(brushColor);
      editorRef.current.setBrushSize(brushSize);
    }
  }, [brushColor, brushSize]);

  useEffect(() => {
    setSelectedText(editorRef.current?.getSelectedText() || null);
    setSelectedImage(
      editorRef.current?.getSelectedImage()
        ? { ...editorRef.current.getSelectedImage()! }
        : null
    );
  }, [activeTool]);

  const onTemplateUpload = () => {
    editorRef.current?.openBasePicker();
    setShowTags(true);
    setActiveTool("none");
  };

  const onAddImage = () => {
    editorRef.current?.setTool("image");
    editorRef.current?.openImagesPicker();
    setActiveTool("image");
  };

  const onRotate = () => {
    editorRef.current?.rotateBy(90);
    setActiveTool("rotate");
  };

  const onAddSpace = () => {
    editorRef.current?.addSpace();
    setActiveTool("space");
  };

  const onText = () => {
    editorRef.current?.setTool("text");
    editorRef.current?.addText();
    setActiveTool("text");
  };

  const onDraw = () => {
    editorRef.current?.setTool("draw");
    setActiveTool("draw");
  };

  const onUndo = () => editorRef.current?.undo();
  const onRedo = () => editorRef.current?.redo();

  const saveMeme = async () => {
    if (!address || !editorRef.current) {
      setError("Canvas or wallet not initialized");
      return;
    }
    if (selectedTags.length === 0) {
      setError("Please select at least one tag");
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

  const updateSelectedText = useCallback(
    (
      partial: Partial<{
        text: string;
        size: number;
        color: string;
        font: string;
        rotationDeg: number;
      }>
    ) => {
      if (selectedText && editorRef.current) {
        editorRef.current.updateText(selectedText.id, partial);
        setSelectedText({ ...selectedText, ...partial });
      }
    },
    [selectedText]
  );

  const clearStrokes = useCallback(() => {
    editorRef.current?.clearStrokes();
  }, []);

  const updatePadding = useCallback((side: string, value: number) => {
    editorRef.current?.setPadding(side as keyof EditorState["padding"], value);
  }, []);

  const scaleSelectedImage = useCallback(
    (factor: number) => {
      if (selectedImage && editorRef.current) {
        editorRef.current.scaleImage(selectedImage.id, factor);
        const updatedImage = editorRef.current.getSelectedImage();
        if (updatedImage) {
          setImageScalePct((prev) =>
            Math.max(10, Math.min(300, prev * factor))
          );
          setSelectedImage({ ...updatedImage });
        }
      }
    },
    [selectedImage]
  );

  const scaleMainImage = useCallback((factor: number) => {
    setMainImageScale((prev) => Math.max(10, Math.min(300, prev * factor)));
  }, []);

  const bringForward = useCallback(() => {
    if (selectedImage && editorRef.current) {
      editorRef.current.bringForwardImage(selectedImage.id);
      setSelectedImage({ ...editorRef.current.getSelectedImage()! });
    }
  }, [selectedImage]);

  const sendBackward = useCallback(() => {
    if (selectedImage && editorRef.current) {
      editorRef.current.sendBackwardImage(selectedImage.id);
      setSelectedImage({ ...editorRef.current.getSelectedImage()! });
    }
  }, [selectedImage]);

  const resetImageSize = useCallback(() => {
    if (selectedImage && editorRef.current) {
      editorRef.current.resetImageSize(selectedImage.id);
      setSelectedImage({ ...editorRef.current.getSelectedImage()! });
      setImageScalePct(100);
    }
  }, [selectedImage]);

  const handleTemplateLoad = useCallback(() => {
    setHasTemplate(true);
    setShowTags(true);
  }, []);

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
        <div
          className="logo"
          onClick={() => router.push("/")}
          style={{ cursor: "pointer" }}
        >
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
            <CanvasEditor
              controls="external"
              ref={editorRef}
              onTemplateLoad={handleTemplateLoad}
              mainImageScale={mainImageScale}
            />
            <div className="toolbox">
              <button
                className="toolbox-button"
                onClick={onRotate}
                title="Rotate canvas 90°"
                disabled={!hasTemplate}
              >
                <Image src="/rotate.png" alt="Rotate" width={25} height={25} />
                <span>Rotate</span>
              </button>
              <button
                className="toolbox-button"
                onClick={onAddSpace}
                title="Add bottom padding"
                disabled={!hasTemplate}
              >
                <Image
                  src="/space.png"
                  alt="Add Space"
                  width={25}
                  height={25}
                />
                <span>Add Space</span>
              </button>
              <button
                className="toolbox-button"
                onClick={onText}
                title="Add or edit text"
                disabled={!hasTemplate}
              >
                <Image src="/text.png" alt="Text" width={25} height={25} />
                <span>Text</span>
              </button>
              <button
                className="toolbox-button"
                onClick={onDraw}
                title="Draw freehand"
                disabled={!hasTemplate}
              >
                <Image src="/draw.png" alt="Draw" width={25} height={25} />
                <span>Draw</span>
              </button>
              <button
                className="toolbox-button"
                onClick={onAddImage}
                title="Add overlay image"
                disabled={!hasTemplate}
              >
                <Image
                  src="/add-image.png"
                  alt="Add Image"
                  width={25}
                  height={25}
                />
                <span>Image</span>
              </button>
            </div>
            <div
              className="undo-btn"
              style={{ display: hasTemplate ? "flex" : "none" }}
            >
              <button className="toolbox-button" onClick={onUndo}>
                <Image src="/undo.png" alt="Undo" width={20} height={20} />
                <span>Undo</span>
              </button>
            </div>
            <div
              className="redo-btn"
              style={{ display: hasTemplate ? "flex" : "none" }}
            >
              <button className="toolbox-button" onClick={onRedo}>
                <Image src="/redo.png" alt="Redo" width={20} height={20} />
                <span>Redo</span>
              </button>
            </div>
          </div>
          <div className="side-panel">
            <div className="tool-controls">
              <button
                className="upload-btn"
                onClick={onTemplateUpload}
                disabled={hasTemplate}
              >
                Upload New Template
                <Image src="/upload.png" alt="Upload" width={20} height={20} />
              </button>
              {activeTool === "text" && (
                <div className="tags-section">
                  <h3>Text Controls</h3>
                  {selectedText && (
                    <>
                      <Input
                        className="w-full"
                        value={selectedText.text}
                        onChange={(e) =>
                          updateSelectedText({ text: e.currentTarget.value })
                        }
                        placeholder="Enter text"
                      />
                      <Input
                        className="w-16"
                        type="color"
                        value={selectedText.color}
                        onChange={(e) =>
                          updateSelectedText({ color: e.currentTarget.value })
                        }
                      />
                    </>
                  )}
                </div>
              )}
              {activeTool === "draw" && (
                <div className="tags-section">
                  <h3>Draw Controls</h3>
                  <div>
                    <Input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.currentTarget.value)}
                    />
                    <input
                      type="range"
                      min={1}
                      max={64}
                      value={brushSize}
                      onChange={(e) =>
                        setBrushSize(Number(e.currentTarget.value))
                      }
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}
            </div>
            {hasTemplate && (
              <div className="tags-section">
                <h3>Select a Tag</h3>
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
                  disabled={!hasTemplate}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  onClick={saveMeme}
                  className="save-btn"
                  disabled={selectedTags.length === 0}
                >
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

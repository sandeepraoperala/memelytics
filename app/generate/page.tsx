"use client";

import Image from "next/image";
import { useRef, useState } from "react";
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

export default function GeneratePage() {
  const editorRef = useRef<CanvasEditorHandle>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);

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
  const onSave = () => editorRef.current?.downloadPNG();

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <Image src="/logo.jpg" alt="logo" width={210} height={40} />
        </div>
        <div className="header-buttons">
          <div className="user-id" style={{ cursor: "default" }}>
            Meme Studio
          </div>
        </div>
      </header>

      <main className="main">
        <h1 className="title">Meme Generator - MEME</h1>

        <div className="generator-container">
          <div className="canvas-area">
            <CanvasEditor controls="external" ref={editorRef} />
            <div className="toolbox">
              <button className="toolbox-button" onClick={onRotate}>
                <Image src="/rotate.jpg" alt="Rotate" width={25} height={25} />
                <span>Rotate</span>
              </button>
              <button className="toolbox-button" onClick={onAddSpace}>
                <Image
                  src="/space.jpg"
                  alt="Add Space"
                  width={25}
                  height={25}
                />
                <span>Add Space</span>
              </button>
              <button className="toolbox-button" onClick={onText}>
                <Image src="/text.jpg" alt="Text" width={25} height={25} />
                <span>Text</span>
              </button>
              <button className="toolbox-button" onClick={onDraw}>
                <Image src="/draw.jpg" alt="Draw" width={25} height={25} />
                <span>Draw</span>
              </button>
              <button className="toolbox-button" onClick={onAddImage}>
                <Image
                  src="/add-image.jpg"
                  alt="Add Image"
                  width={25}
                  height={25}
                />
                <span>Image</span>
              </button>
            </div>
            <div className="undo-btn">
              <button className="toolbox-button" onClick={onUndo}>
                <Image src="/undo.jpg" alt="Undo" width={20} height={20} />
                <span>Undo</span>
              </button>
            </div>
            <div className="redo-btn">
              <button className="toolbox-button" onClick={onRedo}>
                <Image src="/redo.jpg" alt="Redo" width={20} height={20} />
                <span>Redo</span>
              </button>
            </div>
          </div>

          <div className="side-panel">
            <div className="upload-search-container">
              <button className="upload-btn" onClick={onTemplateUpload}>
                Upload New Template
                <Image src="/upload.jpg" alt="Upload" width={20} height={20} />
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
                <button onClick={onSave} className="save-btn">
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

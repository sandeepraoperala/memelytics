"use client";

import type React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TextItem = {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  font: string;
  rotationDeg?: number;
};

type Stroke = {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  size: number;
};

type ImageItem = {
  id: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Tool =
  | "none"
  | "rotate"
  | "text"
  | "draw"
  | "space"
  | "download"
  | "image";

type EditorState = {
  rotationDeg: number;
  padding: { top: number; right: number; bottom: number; left: number };
  bgColor: string;
  texts: TextItem[];
  strokes: Stroke[];
  images: ImageItem[]; // new: overlay image layers
};

export type CanvasEditorHandle = {
  openBasePicker: () => void;
  openImagesPicker: () => void;
  setTool: (tool: Tool) => void;
  addText: () => void;
  rotateBy: (delta: number) => void;
  addSpace: () => void;
  undo: () => void;
  redo: () => void;
  downloadPNG: () => void;
  downloadJPEG: () => void;
};

type CanvasEditorProps = {
  controls?: "internal" | "external";
};

const defaultState: EditorState = {
  rotationDeg: 0,
  padding: { top: 20, right: 20, bottom: 20, left: 20 },
  bgColor: "#ffffff",
  texts: [],
  strokes: [],
  images: [], // initialize images
};

function radians(deg: number) {
  return (deg * Math.PI) / 180;
}

function rotatedBounds(w: number, h: number, angleRad: number) {
  const cos = Math.abs(Math.cos(angleRad));
  const sin = Math.abs(Math.sin(angleRad));
  return {
    width: w * cos + h * sin,
    height: w * sin + h * cos,
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(
  function CanvasEditor({ controls = "internal" }, ref) {
    // Image
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [imageNatural, setImageNatural] = useState<{
      w: number;
      h: number;
    } | null>(null);

    // Editor state + history
    const [state, setState] = useState<EditorState>(defaultState);
    const historyRef = useRef<EditorState[]>([defaultState]);
    const historyIndexRef = useRef<number>(0);
    const pushHistory = useCallback((next: EditorState) => {
      historyRef.current = historyRef.current.slice(
        0,
        historyIndexRef.current + 1
      );
      historyRef.current.push(next);
      historyIndexRef.current = historyRef.current.length - 1;
      setState(next);
    }, []);
    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;

    const undo = useCallback(() => {
      if (!canUndo) return;
      historyIndexRef.current -= 1;
      setState(historyRef.current[historyIndexRef.current]);
    }, [canUndo]);

    const redo = useCallback(() => {
      if (!canRedo) return;
      historyIndexRef.current += 1;
      setState(historyRef.current[historyIndexRef.current]);
    }, [canRedo]);

    const reset = useCallback(() => {
      const base: EditorState = {
        rotationDeg: 0,
        padding: { top: 20, right: 20, bottom: 20, left: 20 },
        bgColor: "#ffffff",
        texts: [],
        strokes: [],
        images: [], // reset images
      };
      historyRef.current = [base];
      historyIndexRef.current = 0;
      setState(base);
      setSelectedTextId(null);
      setSelectedImageId(null); //
      setActiveTool("none");
    }, []);

    // Canvas refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const baseInputRef = useRef<HTMLInputElement | null>(null);
    const imagesInputRef = useRef<HTMLInputElement | null>(null);

    // Selection and dragging
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const draggingRef = useRef<{
      id: string;
      offsetX: number;
      offsetY: number;
    } | null>(null);

    // Tool system, strokes
    const [activeTool, setActiveTool] = useState<Tool>("none");
    const [brushColor, setBrushColor] = useState<string>("#111111");
    const [brushSize, setBrushSize] = useState<number>(6);
    const drawingRef = useRef<{ id: string } | null>(null);
    const stateRef = useRef(state);
    useEffect(() => {
      stateRef.current = state;
    }, [state]);

    const imageMapRef = useRef<Map<string, HTMLImageElement>>(new Map());

    const transformRef = useRef<null | {
      mode: "drag" | "rotate" | "resize";
      id: string;
      target?: "text" | "image"; // track target type
      // drag offsets
      offsetX?: number;
      offsetY?: number;
      // rotate
      centerX?: number;
      centerY?: number;
      startAngleDeg?: number;
      initialRotationDeg?: number;
      // resize
      initialW?: number;
      initialH?: number;
      initialSize?: number;
    }>(null);

    const contentSize = useMemo(() => {
      if (!imageNatural) return { w: 0, h: 0 };
      const w = imageNatural.w + state.padding.left + state.padding.right;
      const h = imageNatural.h + state.padding.top + state.padding.bottom;
      return { w, h };
    }, [imageNatural, state.padding]);

    const onFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputEl = e.currentTarget; // capture ref to avoid synthetic event nulling
        const file = inputEl.files?.[0];
        if (!file) {
          if (baseInputRef.current) baseInputRef.current.value = "";
          return;
        }

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          setImage(img);
          setImageNatural({ w: img.naturalWidth, h: img.naturalHeight });
          const base: EditorState = {
            rotationDeg: 0,
            padding: { top: 20, right: 20, bottom: 20, left: 20 },
            bgColor: "#ffffff",
            texts: [],
            strokes: [],
            images: [], //
          };
          historyRef.current = [base];
          historyIndexRef.current = 0;
          setState(base);
          setSelectedTextId(null);
          setSelectedImageId(null); //
          setActiveTool("none");
          URL.revokeObjectURL(url);
          if (baseInputRef.current) baseInputRef.current.value = "";
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          if (baseInputRef.current) baseInputRef.current.value = "";
        };
        img.src = url;
      },
      []
    );

    const addText = useCallback(() => {
      if (!imageNatural) return;
      const id = uid();
      const newText: TextItem = {
        id,
        text: "Your text",
        x: Math.round(imageNatural.w / 2 - 40),
        y: Math.round(imageNatural.h / 2),
        size: 32,
        color: "#111111",
        font: "Inter, system-ui, Arial, sans-serif",
        rotationDeg: 0,
      };
      const next = { ...state, texts: [...state.texts, newText] };
      pushHistory(next);
      setSelectedTextId(id);
    }, [imageNatural, pushHistory, state]);

    const updateSelectedText = useCallback(
      (partial: Partial<TextItem>) => {
        if (!selectedTextId) return;
        const nextTexts = state.texts.map((t) =>
          t.id === selectedTextId ? { ...t, ...partial } : t
        );
        pushHistory({ ...state, texts: nextTexts });
      },
      [pushHistory, selectedTextId, state]
    );

    const removeSelectedText = useCallback(() => {
      if (!selectedTextId) return;
      const next = {
        ...state,
        texts: state.texts.filter((t) => t.id !== selectedTextId),
      };
      pushHistory(next);
      setSelectedTextId(null);
    }, [pushHistory, selectedTextId, state]);

    const clearStrokes = useCallback(() => {
      const next = { ...state, strokes: [] };
      pushHistory(next);
    }, [pushHistory, state]);

    const rotateBy = useCallback(
      (delta: number) => {
        const next = {
          ...state,
          rotationDeg: (state.rotationDeg + delta) % 360,
        };
        pushHistory(next);
      },
      [pushHistory, state]
    );

    const updatePadding = useCallback(
      (side: keyof EditorState["padding"], value: number) => {
        const v = Math.max(0, Math.min(2000, Math.round(value)));
        const next = { ...state, padding: { ...state.padding, [side]: v } };
        pushHistory(next);
      },
      [pushHistory, state]
    );

    const getContentPointFromClient = useCallback(
      (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !imageNatural) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // map client to canvas pixel space
        const px = (clientX - rect.left) * scaleX;
        const py = (clientY - rect.top) * scaleY;

        // inverse rotate around canvas center
        const angle = radians(state.rotationDeg);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const dx = px - centerX;
        const dy = py - centerY;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;

        const { w: cw, h: ch } = contentSize;
        const cx = rx + cw / 2;
        const cy = ry + ch / 2;
        return { x: cx, y: cy };
      },
      [contentSize, imageNatural, state.rotationDeg]
    );

    const measureText = useCallback((t: TextItem) => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return { w: 0, h: t.size };
      ctx.font = `${t.size}px ${t.font}`;
      const w = ctx.measureText(t.text).width;
      const h = t.size;
      return { w, h };
    }, []);

    const hitTestTextLocal = useCallback(
      (pt: { x: number; y: number }, t: TextItem) => {
        const { w, h } = measureText(t);
        const cx = t.x + w / 2;
        const cy = t.y - h / 2;
        const angle = radians(t.rotationDeg ?? 0);

        // transform to local coordinates (unrotate)
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;

        // local bbox: [-w/2, -h/2] .. [w/2, h/2]
        const within =
          lx >= -w / 2 && lx <= w / 2 && ly >= -h / 2 && ly <= h / 2;

        // handles
        const rotateHandle = { x: 0, y: -h / 2 - 16, r: 8 };
        const resizeHandle = { x: w / 2, y: h / 2, r: 10 }; // square-ish area

        const isOnRotate =
          Math.hypot(lx - rotateHandle.x, ly - rotateHandle.y) <=
          rotateHandle.r;
        const isOnResize =
          Math.abs(lx - resizeHandle.x) <= resizeHandle.r &&
          Math.abs(ly - resizeHandle.y) <= resizeHandle.r;

        return { within, isOnRotate, isOnResize, cx, cy, w, h, lx, ly };
      },
      [measureText]
    );

    const hitTestImage = useCallback(
      (pt: { x: number; y: number }) => {
        // top-most (last) wins
        for (let i = state.images.length - 1; i >= 0; i--) {
          const it = state.images[i];
          const within =
            pt.x >= it.x &&
            pt.x <= it.x + it.w &&
            pt.y >= it.y &&
            pt.y <= it.y + it.h;
          if (!within) continue;
          const handleSize = 12;
          const onResize =
            Math.abs(pt.x - (it.x + it.w)) <= handleSize &&
            Math.abs(pt.y - (it.y + it.h)) <= handleSize;
          return { id: it.id, within: true, isOnResize: onResize };
        }
        return { id: null, within: false, isOnResize: false };
      },
      [state.images]
    );

    const onCanvasPointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!imageNatural) return;
        const pt = getContentPointFromClient(e.clientX, e.clientY);
        if (!pt) return;

        if (activeTool === "image") {
          const hit = hitTestImage(pt);
          setSelectedImageId(hit.id ?? null);

          if (hit.id) {
            const item = state.images.find((x) => x.id === hit.id)!;
            if (hit.isOnResize) {
              transformRef.current = {
                mode: "resize",
                target: "image",
                id: item.id,
                initialW: item.w,
                initialH: item.h,
              };
            } else {
              transformRef.current = {
                mode: "drag",
                target: "image",
                id: item.id,
                offsetX: pt.x - item.x,
                offsetY: pt.y - item.y,
              };
            }
            (e.target as Element).setPointerCapture(e.pointerId);
          } else {
            transformRef.current = null;
          }
          return;
        }

        if (activeTool === "text") {
          // check top-most text (last drawn is top-most)
          let hit: { id: string } | null = null;
          let hitKind: "drag" | "rotate" | "resize" | null = null;
          let hitData: ReturnType<typeof hitTestTextLocal> | null = null;

          for (let i = state.texts.length - 1; i >= 0; i--) {
            const t = state.texts[i];
            const res = hitTestTextLocal(pt, t);
            if (res.isOnRotate) {
              hit = { id: t.id };
              hitKind = "rotate";
              hitData = res;
              break;
            }
            if (res.isOnResize) {
              hit = { id: t.id };
              hitKind = "resize";
              hitData = res;
              break;
            }
            if (res.within) {
              hit = { id: t.id };
              hitKind = "drag";
              hitData = res;
              break;
            }
          }

          setSelectedTextId(hit?.id ?? null);

          if (hit && hitKind && hitData) {
            const t = state.texts.find((x) => x.id === hit.id)!;
            const { cx, cy, w, h } = hitData;
            if (hitKind === "drag") {
              // store offset in local unrotated box coordinates -> convert to world offset
              const offsetX = pt.x - t.x;
              const offsetY = pt.y - (t.y - h);
              transformRef.current = {
                mode: "drag",
                id: t.id,
                offsetX,
                offsetY,
              };
            } else if (hitKind === "rotate") {
              const startAngleDeg =
                (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI;
              transformRef.current = {
                mode: "rotate",
                id: t.id,
                centerX: cx,
                centerY: cy,
                startAngleDeg,
                initialRotationDeg: t.rotationDeg ?? 0,
              };
            } else if (hitKind === "resize") {
              transformRef.current = {
                mode: "resize",
                id: t.id,
                initialW: w,
                initialH: h,
                initialSize: t.size,
              };
            }
            (e.target as Element).setPointerCapture(e.pointerId);
          } else {
            // empty area
            transformRef.current = null;
          }
        } else if (activeTool === "draw") {
          const id = uid();
          const stroke: Stroke = {
            id,
            points: [{ x: pt.x, y: pt.y }],
            color: brushColor,
            size: brushSize,
          };
          setState((prev) => ({ ...prev, strokes: [...prev.strokes, stroke] }));
          drawingRef.current = { id };
          (e.target as Element).setPointerCapture(e.pointerId);
        } else {
          setSelectedTextId(null);
          setSelectedImageId(null); //
        }
      },
      [
        activeTool,
        brushColor,
        brushSize,
        getContentPointFromClient,
        hitTestTextLocal,
        imageNatural,
        state.texts,
        hitTestImage, //
        state.images, //
      ]
    );

    const onCanvasPointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        const pt = getContentPointFromClient(e.clientX, e.clientY);
        if (!pt) return;

        if (activeTool === "image") {
          const tf = transformRef.current;
          if (!tf) return;
          if (tf.target !== "image") return;

          if (tf.mode === "drag") {
            const it = state.images.find((x) => x.id === tf.id);
            if (!it) return;
            const { w: cw, h: ch } = contentSize;
            const newX = Math.max(
              0,
              Math.min(cw - it.w, pt.x - (tf.offsetX ?? 0))
            );
            const newY = Math.max(
              0,
              Math.min(ch - it.h, pt.y - (tf.offsetY ?? 0))
            );
            setState((prev) => ({
              ...prev,
              images: prev.images.map((x) =>
                x.id === tf.id ? { ...x, x: newX, y: newY } : x
              ),
            }));
            return;
          }

          if (tf.mode === "resize") {
            const it = state.images.find((x) => x.id === tf.id);
            if (!it || tf.initialW == null || tf.initialH == null) return;
            const startW = tf.initialW;
            const startH = tf.initialH;
            // uniform scale by delta from top-left to pointer
            const dx = Math.max(16, pt.x - it.x);
            const dy = Math.max(16, pt.y - it.y);
            const scale = Math.max(
              0.1,
              Math.min(10, Math.min(dx / startW, dy / startH))
            );
            const newW = Math.max(16, Math.round(startW * scale));
            const newH = Math.max(16, Math.round(startH * scale));
            const { w: cw, h: ch } = contentSize;
            const clampedW = Math.min(newW, cw - it.x);
            const clampedH = Math.min(newH, ch - it.y);
            setState((prev) => ({
              ...prev,
              images: prev.images.map((x) =>
                x.id === tf.id ? { ...x, w: clampedW, h: clampedH } : x
              ),
            }));
            return;
          }
        }

        if (activeTool === "text") {
          const tf = transformRef.current;
          if (!tf) return;

          if (tf.mode === "drag") {
            const t = state.texts.find((x) => x.id === tf.id);
            if (!t || !imageNatural) return;
            const h = t.size;
            const newX = Math.max(
              0,
              Math.min(imageNatural.w, pt.x - (tf.offsetX ?? 0))
            );
            const newY = Math.max(
              h,
              Math.min(imageNatural.h, pt.y - (tf.offsetY ?? 0) + h)
            );
            setState((prev) => ({
              ...prev,
              texts: prev.texts.map((x) =>
                x.id === tf.id ? { ...x, x: newX, y: newY } : x
              ),
            }));
            return;
          }

          if (tf.mode === "rotate") {
            const t = state.texts.find((x) => x.id === tf.id);
            if (!t || tf.centerX == null || tf.centerY == null) return;
            const currentAngleDeg =
              (Math.atan2(pt.y - tf.centerY, pt.x - tf.centerX) * 180) /
              Math.PI;
            const delta = currentAngleDeg - (tf.startAngleDeg ?? 0);
            const newRot = ((tf.initialRotationDeg ?? 0) + delta) % 360;
            setState((prev) => ({
              ...prev,
              texts: prev.texts.map((x) =>
                x.id === tf.id ? { ...x, rotationDeg: newRot } : x
              ),
            }));
            return;
          }

          if (tf.mode === "resize") {
            const t = state.texts.find((x) => x.id === tf.id);
            if (!t || tf.initialW == null || tf.initialSize == null) return;
            // scale size proportionally by delta to bottom-right
            const { w, h } = measureText(t);
            const scale = Math.max(
              0.2,
              Math.min(
                10,
                Math.hypot(pt.x - t.x, pt.y - t.y) / Math.hypot(tf.initialW, h)
              )
            );
            const newSize = Math.round(tf.initialSize * scale);
            setState((prev) => ({
              ...prev,
              texts: prev.texts.map((x) =>
                x.id === tf.id
                  ? { ...x, size: Math.max(8, Math.min(256, newSize)) }
                  : x
              ),
            }));
            return;
          }
        }

        if (activeTool === "draw") {
          const drawing = drawingRef.current;
          if (!drawing) return;
          setState((prev) => ({
            ...prev,
            strokes: prev.strokes.map((s) =>
              s.id === drawing.id
                ? { ...s, points: [...s.points, { x: pt.x, y: pt.y }] }
                : s
            ),
          }));
        }
      },
      [
        activeTool,
        contentSize,
        getContentPointFromClient,
        imageNatural,
        measureText,
        state.images,
        state.texts,
      ]
    );

    const onCanvasPointerUp = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (activeTool === "image") {
          if (transformRef.current) {
            transformRef.current = null;
            pushHistory(stateRef.current);
            try {
              (e.target as Element).releasePointerCapture(e.pointerId);
            } catch {}
          }
          return;
        }

        if (activeTool === "text") {
          if (transformRef.current) {
            transformRef.current = null;
            pushHistory(stateRef.current);
            try {
              (e.target as Element).releasePointerCapture(e.pointerId);
            } catch {}
          }
          return;
        }

        if (activeTool === "draw") {
          if (drawingRef.current) {
            drawingRef.current = null;
            pushHistory(stateRef.current);
            try {
              (e.target as Element).releasePointerCapture(e.pointerId);
            } catch {}
          }
        }
      },
      [activeTool, pushHistory]
    );

    const onAddImages = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!imageNatural) {
          if (imagesInputRef.current) imagesInputRef.current.value = "";
          return;
        }
        const files = e.currentTarget.files;
        if (!files || files.length === 0) {
          if (imagesInputRef.current) imagesInputRef.current.value = "";
          return;
        }

        const inputEl = e.currentTarget; // capture safely

        const toLoad: Promise<ImageItem | null>[] = [];
        for (const file of Array.from(files)) {
          const url = URL.createObjectURL(file);
          toLoad.push(
            new Promise((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                // place centered at 50% size (clamped)
                const maxW = imageNatural.w;
                const maxH = imageNatural.h;
                const scale = 0.5;
                const naturalW = img.naturalWidth;
                const naturalH = img.naturalHeight;
                const aspect = naturalW / Math.max(1, naturalH);
                let w = Math.max(
                  32,
                  Math.min(maxW, Math.round(naturalW * scale))
                );
                let h = Math.round(w / aspect);
                if (h > maxH) {
                  h = Math.max(32, Math.min(maxH, Math.round(maxH)));
                  w = Math.round(h * aspect);
                }
                const id = uid();
                imageMapRef.current.set(id, img);
                const x = Math.round(state.padding.left + (maxW - w) / 2);
                const y = Math.round(state.padding.top + (maxH - h) / 2);
                URL.revokeObjectURL(url);
                resolve({ id, src: "", x, y, w, h });
              };
              img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
              };
              img.src = url;
            })
          );
        }

        Promise.all(toLoad).then((results) => {
          const newItems = results.filter(Boolean) as ImageItem[];
          if (!newItems.length) {
            if (inputEl) inputEl.value = "";
            return;
          }
          const next = { ...state, images: [...state.images, ...newItems] };
          pushHistory(next);
          setSelectedImageId(newItems[newItems.length - 1].id);
          if (inputEl) inputEl.value = "";
        });
      },
      [imageNatural, pushHistory, state, imageMapRef, state?.padding]
    );

    const drawBaseCanvas = useCallback(
      (drawGuides: boolean) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (!image || !imageNatural) {
          const w = 800;
          const h = 500;
          canvas.width = w;
          canvas.height = h;
          ctx.clearRect(0, 0, w, h);
          const size = 16;
          for (let y = 0; y < h; y += size) {
            for (let x = 0; x < w; x += size) {
              ctx.fillStyle =
                ((x / size + y / size) | 0) % 2 ? "#f3f3f3" : "#e8e8e8";
              ctx.fillRect(x, y, size, size);
            }
          }
          ctx.fillStyle = "#666666";
          ctx.font = "14px Inter, system-ui, Arial, sans-serif";
          ctx.fillText("Upload an image or GIF to start", 16, 28);
          return;
        }

        const angle = radians(state.rotationDeg);
        const { w: cw, h: ch } = contentSize;

        const off = document.createElement("canvas");
        off.width = Math.max(1, cw);
        off.height = Math.max(1, ch);
        const offCtx = off.getContext("2d")!;

        offCtx.fillStyle = state.bgColor;
        offCtx.fillRect(0, 0, off.width, off.height);

        offCtx.drawImage(image, state.padding.left, state.padding.top);

        for (const it of state.images) {
          const el = imageMapRef.current.get(it.id);
          if (el) {
            offCtx.drawImage(el, it.x, it.y, it.w, it.h);
          }
          if (drawGuides && selectedImageId === it.id) {
            offCtx.save();
            offCtx.strokeStyle = "#3b82f6";
            offCtx.setLineDash([4, 3]);
            offCtx.strokeRect(it.x, it.y, it.w, it.h);
            offCtx.setLineDash([]);
            offCtx.fillStyle = "#3b82f6";
            offCtx.fillRect(it.x + it.w - 6, it.y + it.h - 6, 12, 12); // resize handle
            offCtx.restore();
          }
        }

        for (const t of state.texts) {
          const { w, h } = measureText(t);
          const cx = t.x + w / 2;
          const cy = t.y - h / 2;
          offCtx.save();
          offCtx.translate(cx, cy);
          offCtx.rotate(radians(t.rotationDeg ?? 0));
          offCtx.fillStyle = t.color;
          offCtx.textBaseline = "middle";
          offCtx.font = `${t.size}px ${t.font}`;
          // draw centered
          offCtx.fillText(t.text, -w / 2, 0);
          if (drawGuides && t.id === selectedTextId) {
            offCtx.strokeStyle = "#ef4444";
            offCtx.setLineDash([4, 3]);
            offCtx.strokeRect(-w / 2, -h / 2, w, h);
            offCtx.setLineDash([]);

            // rotate handle (circle above)
            offCtx.beginPath();
            offCtx.arc(0, -h / 2 - 16, 6, 0, Math.PI * 2);
            offCtx.fillStyle = "#ef4444";
            offCtx.fill();

            // resize handle (square bottom-right)
            offCtx.fillStyle = "#ef4444";
            offCtx.fillRect(w / 2 - 6, h / 2 - 6, 12, 12);
          }
          offCtx.restore();
        }

        offCtx.lineJoin = "round";
        offCtx.lineCap = "round";
        for (const s of state.strokes) {
          if (s.points.length < 2) {
            offCtx.fillStyle = s.color;
            offCtx.beginPath();
            offCtx.arc(
              s.points[0].x,
              s.points[0].y,
              s.size / 2,
              0,
              Math.PI * 2
            );
            offCtx.fill();
            continue;
          }
          offCtx.strokeStyle = s.color;
          offCtx.lineWidth = s.size;
          offCtx.beginPath();
          offCtx.moveTo(s.points[0].x, s.points[0].y);
          for (let i = 1; i < s.points.length; i++) {
            offCtx.lineTo(s.points[i].x, s.points[i].y);
          }
          offCtx.stroke();
        }

        const bounds = rotatedBounds(off.width, off.height, angle);
        const outW = Math.ceil(bounds.width);
        const outH = Math.ceil(bounds.height);
        canvas.width = outW;
        canvas.height = outH;

        const size = 16;
        for (let y = 0; y < outH; y += size) {
          for (let x = 0; x < outW; x += size) {
            ctx.fillStyle =
              ((x / size + y / size) | 0) % 2 ? "#f8f8f8" : "#efefef";
            ctx.fillRect(x, y, size, size);
          }
        }

        ctx.save();
        ctx.translate(outW / 2, outH / 2);
        ctx.rotate(angle);
        ctx.drawImage(off, -off.width / 2, -off.height / 2);
        ctx.restore();
      },
      [
        image,
        imageNatural,
        measureText,
        selectedTextId,
        selectedImageId,
        state,
        contentSize,
      ]
    );

    const download = useCallback(
      (type: "png" | "jpeg") => {
        const angle = radians(state.rotationDeg);
        const { w: cw, h: ch } = contentSize;

        // Compose offscreen (unrotated)
        const off = document.createElement("canvas");
        off.width = Math.max(1, cw);
        off.height = Math.max(1, ch);
        const offCtx = off.getContext("2d")!;

        offCtx.fillStyle = state.bgColor;
        offCtx.fillRect(0, 0, off.width, off.height);
        if (image)
          offCtx.drawImage(image, state.padding.left, state.padding.top);

        for (const it of state.images) {
          const el = imageMapRef.current.get(it.id);
          if (el) offCtx.drawImage(el, it.x, it.y, it.w, it.h);
        }

        // (update texts loop accordingly)
        for (const t of state.texts) {
          const { w, h } = measureText(t);
          const cx = t.x + w / 2;
          const cy = t.y - h / 2;
          offCtx.save();
          offCtx.translate(cx, cy);
          offCtx.rotate(radians(t.rotationDeg ?? 0));
          offCtx.fillStyle = t.color;
          offCtx.textBaseline = "middle";
          offCtx.font = `${t.size}px ${t.font}`;
          offCtx.fillText(t.text, -w / 2, 0);
          offCtx.restore();
        }

        // Draw strokes above image and text
        offCtx.lineJoin = "round";
        offCtx.lineCap = "round";
        for (const s of state.strokes) {
          if (s.points.length < 2) {
            offCtx.fillStyle = s.color;
            offCtx.beginPath();
            offCtx.arc(
              s.points[0].x,
              s.points[0].y,
              s.size / 2,
              0,
              Math.PI * 2
            );
            offCtx.fill();
          } else {
            offCtx.strokeStyle = s.color;
            offCtx.lineWidth = s.size;
            offCtx.beginPath();
            offCtx.moveTo(s.points[0].x, s.points[0].y);
            for (let i = 1; i < s.points.length; i++)
              offCtx.lineTo(s.points[i].x, s.points[i].y);
            offCtx.stroke();
          }
        }

        // Rotate into a final export canvas
        const bounds = rotatedBounds(off.width, off.height, angle);
        const outW = Math.ceil(bounds.width);
        const outH = Math.ceil(bounds.height);
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = outW;
        exportCanvas.height = outH;
        const ctx = exportCanvas.getContext("2d")!;
        ctx.save();
        ctx.translate(outW / 2, outH / 2);
        ctx.rotate(angle);
        ctx.drawImage(off, -off.width / 2, -off.height / 2);
        ctx.restore();

        const dataURL = exportCanvas.toDataURL(`image/${type}`);
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = `canvas-editor.${type}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
      [image, contentSize, state, measureText]
    );

    const onCanvasWheel = useCallback(
      (e: React.WheelEvent<HTMLCanvasElement>) => {
        if (activeTool === "image" && selectedImageId) {
          e.preventDefault();
          const factor = e.deltaY > 0 ? 0.95 : 1.05;
          scaleSelectedImage(factor);
        }
      },
      [activeTool, selectedImageId]
    );

    const scaleSelectedImage = useCallback(
      (factor: number) => {
        if (!selectedImageId) return;
        const it = state.images.find((x) => x.id === selectedImageId);
        if (!it) return;
        const { w: cw, h: ch } = contentSize;
        const newW = Math.max(16, Math.round(it.w * factor));
        const newH = Math.max(16, Math.round(it.h * factor));
        const clampedW = Math.min(newW, cw - it.x);
        const clampedH = Math.min(newH, ch - it.y);
        const nextImages = state.images.map((x) =>
          x.id === it.id ? { ...x, w: clampedW, h: clampedH } : x
        );
        pushHistory({ ...state, images: nextImages });
      },
      [contentSize, pushHistory, selectedImageId, state]
    );

    const bringForward = useCallback(() => {
      if (!selectedImageId) return;
      const idx = state.images.findIndex((i) => i.id === selectedImageId);
      if (idx < 0 || idx === state.images.length - 1) return;
      const arr = [...state.images];
      const [item] = arr.splice(idx, 1);
      arr.push(item);
      pushHistory({ ...state, images: arr });
    }, [selectedImageId, state, pushHistory]);

    const sendBackward = useCallback(() => {
      if (!selectedImageId) return;
      const idx = state.images.findIndex((i) => i.id === selectedImageId);
      if (idx <= 0) return;
      const arr = [...state.images];
      const [item] = arr.splice(idx, 1);
      arr.unshift(item);
      pushHistory({ ...state, images: arr });
    }, [selectedImageId, state, pushHistory]);

    const selectedText = useMemo(
      () => state.texts.find((t) => t.id === selectedTextId) || null,
      [selectedTextId, state.texts]
    );

    const selectedImage = useMemo(
      () => state.images.find((i) => i.id === selectedImageId) || null,
      [selectedImageId, state.images]
    );

    const imageScalePct = useMemo(() => {
      if (!selectedImage) return 100;
      const el = imageMapRef.current.get(selectedImage.id);
      if (!el) return 100;
      return Math.max(1, Math.round((selectedImage.w / el.naturalWidth) * 100));
    }, [selectedImage]);

    // Helper for selected image updates and scaling
    const updateSelectedImage = useCallback(
      (partial: Partial<ImageItem>) => {
        if (!selectedImageId) return;
        const nextImages = state.images.map((it) =>
          it.id === selectedImageId ? { ...it, ...partial } : it
        );
        pushHistory({ ...state, images: nextImages });
      },
      [pushHistory, selectedImageId, state]
    );

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (!image) return;

        // Undo / Redo
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
          e.preventDefault();
          redo();
          return;
        }

        // Deselect
        if (e.key === "Escape") {
          setSelectedTextId(null);
          setSelectedImageId(null);
          return;
        }

        const step = e.shiftKey ? 10 : 1;

        // Nudge image selection
        if (selectedImageId) {
          const it = stateRef.current.images.find(
            (x) => x.id === selectedImageId
          );
          if (!it) return;
          let { x, y } = it;
          if (e.key === "ArrowLeft") x = Math.max(0, x - step);
          if (e.key === "ArrowRight")
            x = Math.min(contentSize.w - it.w, x + step);
          if (e.key === "ArrowUp") y = Math.max(0, y - step);
          if (e.key === "ArrowDown")
            y = Math.min(contentSize.h - it.h, y + step);
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          ) {
            e.preventDefault();
            const nextImages = stateRef.current.images.map((img) =>
              img.id === it.id ? { ...img, x, y } : img
            );
            pushHistory({ ...stateRef.current, images: nextImages });
            return;
          }
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            const next = {
              ...stateRef.current,
              images: stateRef.current.images.filter((img) => img.id !== it.id),
            };
            pushHistory(next);
            setSelectedImageId(null);
            return;
          }
        }

        // Nudge text selection
        if (selectedTextId) {
          const t = stateRef.current.texts.find((x) => x.id === selectedTextId);
          if (!t) return;
          let { x, y } = t;
          const h = t.size;
          if (e.key === "ArrowLeft") x = Math.max(0, x - step);
          if (e.key === "ArrowRight")
            x = Math.min(imageNatural?.w ?? x, x + step);
          if (e.key === "ArrowUp") y = Math.max(h, y - step);
          if (e.key === "ArrowDown")
            y = Math.min(imageNatural?.h ?? y, y + step);
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].some((k) =>
              e.key.includes(k)
            )
          ) {
            e.preventDefault();
            const nextTexts = stateRef.current.texts.map((txt) =>
              txt.id === t.id ? { ...txt, x, y } : txt
            );
            pushHistory({ ...stateRef.current, texts: nextTexts });
            return;
          }
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            const next = {
              ...stateRef.current,
              texts: stateRef.current.texts.filter((txt) => txt.id !== t.id),
            };
            pushHistory(next);
            setSelectedTextId(null);
          }
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [
      image,
      redo,
      undo,
      selectedImageId,
      selectedTextId,
      contentSize,
      imageNatural,
      pushHistory,
    ]);

    useEffect(() => {
      drawBaseCanvas(true);
    }, [drawBaseCanvas]);

    useImperativeHandle(
      ref,
      () => ({
        openBasePicker: () => baseInputRef.current?.click(),
        openImagesPicker: () => imagesInputRef.current?.click(),
        setTool: (tool: Tool) => setActiveTool(tool),
        addText: () => addText(),
        rotateBy: (delta: number) => rotateBy(delta),
        addSpace: () =>
          updatePadding("bottom", stateRef.current.padding.bottom + 50),
        undo: () => undo(),
        redo: () => redo(),
        downloadPNG: () => download("png"),
        downloadJPEG: () => download("jpeg"),
      }),
      [undo, redo, rotateBy, updatePadding, addText, download]
    );

    return (
      <section className="rounded-lg border bg-card p-3 md:p-4">
        <input
          ref={baseInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          style={{ display: "none" }}
          aria-hidden
          tabIndex={-1}
        />
        <input
          ref={imagesInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onAddImages}
          style={{ display: "none" }}
          aria-hidden
          tabIndex={-1}
        />

        {controls === "internal" && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="w-auto cursor-pointer"
                />
              </label>

              <div className="h-6 w-px bg-border" />

              <Button
                variant={activeTool === "text" ? "default" : "secondary"}
                onClick={() => setActiveTool("text")}
                disabled={!image}
                aria-pressed={activeTool === "text"}
              >
                Text
              </Button>
              <Button
                variant={activeTool === "draw" ? "default" : "secondary"}
                onClick={() => setActiveTool("draw")}
                disabled={!image}
                aria-pressed={activeTool === "draw"}
              >
                Draw
              </Button>
              <Button
                variant={activeTool === "rotate" ? "default" : "secondary"}
                onClick={() => setActiveTool("rotate")}
                disabled={!image}
                aria-pressed={activeTool === "rotate"}
              >
                Rotate Canvas
              </Button>
              <Button
                variant={activeTool === "space" ? "default" : "secondary"}
                onClick={() => setActiveTool("space")}
                disabled={!image}
                aria-pressed={activeTool === "space"}
              >
                Add Space
              </Button>
              <Button
                variant={activeTool === "download" ? "default" : "secondary"}
                onClick={() => setActiveTool("download")}
                disabled={!image}
                aria-pressed={activeTool === "download"}
              >
                Download
              </Button>
              <Button
                variant={activeTool === "image" ? "default" : "secondary"}
                onClick={() => setActiveTool("image")}
                disabled={!image}
                aria-pressed={activeTool === "image"}
              >
                Images
              </Button>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={undo}
                  disabled={!image || !canUndo}
                >
                  Undo
                </Button>
                <Button
                  variant="outline"
                  onClick={redo}
                  disabled={!image || !canRedo}
                >
                  Redo
                </Button>
                <Button variant="ghost" onClick={reset} disabled={!image}>
                  Reset
                </Button>
              </div>
            </div>

            {/* Inline tool options row */}
            {image && (
              <div className="mb-3 grid gap-3">
                {activeTool === "text" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="default" size="sm" onClick={addText}>
                      Add Text
                    </Button>
                    {selectedText && (
                      <>
                        <Input
                          className="w-48"
                          value={selectedText.text}
                          onChange={(e) =>
                            updateSelectedText({ text: e.currentTarget.value })
                          }
                          placeholder="Enter text"
                        />
                        <Input
                          className="w-24"
                          type="number"
                          min={8}
                          max={256}
                          value={selectedText.size}
                          onChange={(e) =>
                            updateSelectedText({
                              size: Number(e.currentTarget.value),
                            })
                          }
                        />
                        <Input
                          className="w-16"
                          type="color"
                          value={selectedText.color}
                          onChange={(e) =>
                            updateSelectedText({ color: e.currentTarget.value })
                          }
                        />
                        <Input
                          className="w-56"
                          value={selectedText.font}
                          onChange={(e) =>
                            updateSelectedText({ font: e.currentTarget.value })
                          }
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => updateSelectedText({ rotationDeg: 0 })}
                        >
                          Reset Text Rotation
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={removeSelectedText}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {activeTool === "draw" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Brush</span>
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
                    />
                    <Button
                      variant="secondary"
                      onClick={clearStrokes}
                      disabled={!state.strokes.length}
                    >
                      Clear Drawings
                    </Button>
                  </div>
                )}

                {activeTool === "rotate" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Canvas Rotation
                    </span>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={state.rotationDeg}
                      onChange={(e) =>
                        pushHistory({
                          ...state,
                          rotationDeg: Number.parseInt(
                            e.currentTarget.value,
                            10
                          ),
                        })
                      }
                    />
                    <Button variant="secondary" onClick={() => rotateBy(-90)}>
                      -90°
                    </Button>
                    <Button variant="secondary" onClick={() => rotateBy(90)}>
                      +90°
                    </Button>
                    <Button variant="secondary" onClick={() => rotateBy(180)}>
                      180°
                    </Button>
                  </div>
                )}

                {activeTool === "space" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Padding
                    </span>
                    <Input
                      className="w-20"
                      type="number"
                      min={0}
                      max={2000}
                      value={state.padding.top}
                      onChange={(e) =>
                        updatePadding("top", Number(e.currentTarget.value))
                      }
                    />
                    <Input
                      className="w-20"
                      type="number"
                      min={0}
                      max={2000}
                      value={state.padding.right}
                      onChange={(e) =>
                        updatePadding("right", Number(e.currentTarget.value))
                      }
                    />
                    <Input
                      className="w-20"
                      type="number"
                      min={0}
                      max={2000}
                      value={state.padding.bottom}
                      onChange={(e) =>
                        updatePadding("bottom", Number(e.currentTarget.value))
                      }
                    />
                    <Input
                      className="w-20"
                      type="number"
                      min={0}
                      max={2000}
                      value={state.padding.left}
                      onChange={(e) =>
                        updatePadding("left", Number(e.currentTarget.value))
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      Background
                    </span>
                    <Input
                      type="color"
                      value={state.bgColor}
                      onChange={(e) =>
                        pushHistory({
                          ...state,
                          bgColor: e.currentTarget.value,
                        })
                      }
                    />
                  </div>
                )}

                {activeTool === "download" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="default" onClick={() => download("png")}>
                      Download PNG
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => download("jpeg")}
                    >
                      Download JPEG
                    </Button>
                  </div>
                )}

                {activeTool === "image" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      Add Images
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={onAddImages}
                        className="w-auto"
                      />
                    </label>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (!selectedImageId) return;
                        const next = {
                          ...state,
                          images: state.images.filter(
                            (i) => i.id !== selectedImageId
                          ),
                        };
                        pushHistory(next);
                        setSelectedImageId(null);
                      }}
                      disabled={!selectedImageId}
                    >
                      Remove Selected
                    </Button>

                    {selectedImage && (
                      <>
                        <span className="text-xs text-muted-foreground">
                          Scale
                        </span>
                        <input
                          aria-label="Scale selected image"
                          type="range"
                          min={10}
                          max={300}
                          value={imageScalePct}
                          onChange={(e) => {
                            const pct = Number(e.currentTarget.value);
                            const el = imageMapRef.current.get(
                              selectedImage.id
                            );
                            const natW = el?.naturalWidth || selectedImage.w;
                            const natH = el?.naturalHeight || selectedImage.h;
                            const scale = Math.max(0.1, Math.min(3, pct / 100));
                            const { w: cw, h: ch } = contentSize;
                            const newW = Math.max(16, Math.round(natW * scale));
                            const newH = Math.max(16, Math.round(natH * scale));
                            const clampedW = Math.min(
                              newW,
                              cw - selectedImage.x
                            );
                            const clampedH = Math.min(
                              newH,
                              ch - selectedImage.y
                            );
                            const nextImages = state.images.map((x) =>
                              x.id === selectedImage.id
                                ? { ...x, w: clampedW, h: clampedH }
                                : x
                            );
                            pushHistory({ ...state, images: nextImages });
                          }}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => scaleSelectedImage(0.9)}
                        >
                          -
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => scaleSelectedImage(1.1)}
                        >
                          +
                        </Button>
                        <span className="text-xs text-muted-foreground">{`${selectedImage.w}×${selectedImage.h}px`}</span>
                        <div className="h-6 w-px bg-border" />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={bringForward}
                        >
                          Bring Front
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={sendBackward}
                        >
                          Send Back
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const it = selectedImage;
                            const el = imageMapRef.current.get(it.id);
                            const natW = el?.naturalWidth || it.w;
                            const natH = el?.naturalHeight || it.h;
                            const { w: cw, h: ch } = contentSize;
                            const newW = Math.min(natW, cw - it.x);
                            const newH = Math.min(natH, ch - it.y);
                            updateSelectedImage({ w: newW, h: newH });
                          }}
                        >
                          Reset Size
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Tip: use mouse wheel to resize, arrows to nudge, Shift
                          for 10px steps
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div
          className={cn(
            "relative w-full overflow-auto rounded-md border bg-muted/50",
            "flex items-center justify-center"
          )}
          style={{ minHeight: 300 }}
        >
          <canvas
            ref={canvasRef}
            className={cn(
              "block max-w-full touch-none",
              activeTool === "draw"
                ? "cursor-crosshair"
                : activeTool === "text" || activeTool === "image"
                ? "cursor-move"
                : "cursor-default"
            )}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onWheel={onCanvasWheel}
          />
        </div>
      </section>
    );
  }
);

export default CanvasEditor;

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

type Tool = "none" | "rotate" | "text" | "draw" | "download" | "image";

type EditorState = {
  rotationDeg: number;
  bgColor: string;
  texts: TextItem[];
  strokes: Stroke[];
  images: ImageItem[];
};

export type CanvasEditorHandle = {
  openBasePicker: () => void;
  openImagesPicker: () => void;
  setTool: (tool: Tool) => void;
  setBrushColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  addText: () => void;
  updateText: (id: string, partial: Partial<TextItem>) => void;
  removeText: (id: string) => void;
  clearStrokes: () => void;
  rotateBy: (delta: number) => void;
  undo: () => void;
  redo: () => void;
  downloadPNG: () => void;
  downloadJPEG: () => void;
  loadTemplate: (url: string) => void;
  getDataURL: (type: "png" | "jpeg") => string;
  scaleImage: (id: string, factor: number) => void;
  bringForwardImage: (id: string) => void;
  sendBackwardImage: (id: string) => void;
  resetImageSize: (id: string) => void;
  getSelectedText: () => TextItem | null;
  getSelectedImage: () => ImageItem | null;
  removeImage: (id: string) => void;
};

type CanvasEditorProps = {
  controls?: "internal" | "external";
  onTemplateLoad?: () => void;
};

const defaultState: EditorState = {
  rotationDeg: 0,
  bgColor: "#ffffff",
  texts: [],
  strokes: [],
  images: [],
};

const FIXED_CANVAS_WIDTH = 800;
const FIXED_CANVAS_HEIGHT = 600;

function radians(deg: number) {
  return (deg * Math.PI) / 180;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(
  function CanvasEditor({ controls = "internal", onTemplateLoad }, ref) {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [imageNatural, setImageNatural] = useState<{
      w: number;
      h: number;
    } | null>(null);
    const [state, setState] = useState<EditorState>(defaultState);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
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
      const base: EditorState = defaultState;
      historyRef.current = [base];
      historyIndexRef.current = 0;
      setState(base);
      setSelectedTextId(null);
      setSelectedImageId(null);
      setEditingTextId(null);
    }, []);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const baseInputRef = useRef<HTMLInputElement | null>(null);
    const imagesInputRef = useRef<HTMLInputElement | null>(null);
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
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
      target?: "text" | "image";
      offsetX?: number;
      offsetY?: number;
      centerX?: number;
      centerY?: number;
      startAngleDeg?: number;
      initialRotationDeg?: number;
      initialW?: number;
      initialH?: number;
      initialSize?: number;
    }>(null);

    const contentSize = useMemo(() => {
      if (!imageNatural)
        return { w: FIXED_CANVAS_WIDTH, h: FIXED_CANVAS_HEIGHT };
      return { w: imageNatural.w, h: imageNatural.h };
    }, [imageNatural]);

    const getImageBounds = useCallback(() => {
      if (!imageNatural)
        return { x: 0, y: 0, w: FIXED_CANVAS_WIDTH, h: FIXED_CANVAS_HEIGHT };
      return { x: 0, y: 0, w: imageNatural.w, h: imageNatural.h };
    }, [imageNatural]);

    const onFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputEl = e.currentTarget;
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
          reset();
          onTemplateLoad?.();
          URL.revokeObjectURL(url);
          if (baseInputRef.current) baseInputRef.current.value = "";
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          if (baseInputRef.current) baseInputRef.current.value = "";
        };
        img.src = url;
      },
      [reset, onTemplateLoad]
    );

    const loadTemplate = useCallback(
      (url: string) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          setImage(img);
          setImageNatural({ w: img.naturalWidth, h: img.naturalHeight });
          reset();
          onTemplateLoad?.();
        };
        img.onerror = () => {
          console.error("Failed to load template:", url);
        };
        img.src = url;
      },
      [reset, onTemplateLoad]
    );

    const addText = useCallback(() => {
      const id = uid();
      const newText: TextItem = {
        id,
        text: "",
        x: contentSize.w / 2,
        y: contentSize.h / 2,
        size: 20,
        color: "#000",
        font: "Fredoka One",
        rotationDeg: 0,
      };
      const next = { ...state, texts: [...state.texts, newText] };
      pushHistory(next);
      setSelectedTextId(id);
      setEditingTextId(id);
    }, [pushHistory, state, contentSize]);

    const updateText = useCallback(
      (id: string, partial: Partial<TextItem>) => {
        const nextTexts = state.texts.map((t) =>
          t.id === id ? { ...t, ...partial } : t
        );
        pushHistory({ ...state, texts: nextTexts });
        setSelectedTextId(id);
      },
      [pushHistory, state]
    );

    const removeText = useCallback(
      (id: string) => {
        const next = {
          ...state,
          texts: state.texts.filter((t) => t.id !== id),
        };
        pushHistory(next);
        if (selectedTextId === id) {
          setSelectedTextId(null);
          setEditingTextId(null);
        }
      },
      [pushHistory, selectedTextId, state]
    );

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

    const scaleImage = useCallback(
      (id: string, factor: number) => {
        const it = state.images.find((x) => x.id === id);
        if (!it) return;
        const newW = Math.max(16, Math.round(it.w * factor));
        const newH = Math.max(16, Math.round(it.h * factor));
        const clampedW = Math.min(newW, contentSize.w - it.x);
        const clampedH = Math.min(newH, contentSize.h - it.y);
        const nextImages = state.images.map((x) =>
          x.id === id ? { ...x, w: clampedW, h: clampedH } : x
        );
        pushHistory({ ...state, images: nextImages });
      },
      [pushHistory, state, contentSize]
    );

    const bringForwardImage = useCallback(
      (id: string) => {
        const idx = state.images.findIndex((i) => i.id === id);
        if (idx < 0 || idx === state.images.length - 1) return;
        const arr = [...state.images];
        const [item] = arr.splice(idx, 1);
        arr.push(item);
        pushHistory({ ...state, images: arr });
      },
      [pushHistory, state]
    );

    const sendBackwardImage = useCallback(
      (id: string) => {
        const idx = state.images.findIndex((i) => i.id === id);
        if (idx <= 0) return;
        const arr = [...state.images];
        const [item] = arr.splice(idx, 1);
        arr.unshift(item);
        pushHistory({ ...state, images: arr });
      },
      [pushHistory, state]
    );

    const resetImageSize = useCallback(
      (id: string) => {
        const it = state.images.find((i) => i.id === id);
        if (!it) return;
        const el = imageMapRef.current.get(it.id);
        const natW = el?.naturalWidth || it.w;
        const natH = el?.naturalHeight || it.h;
        const scale = Math.min(
          (contentSize.w - it.x) / natW,
          (contentSize.h - it.y) / natH,
          1
        );
        const newW = Math.min(Math.round(natW * scale), contentSize.w - it.x);
        const newH = Math.min(Math.round(natH * scale), contentSize.h - it.y);
        const nextImages = state.images.map((x) =>
          x.id === id ? { ...x, w: newW, h: newH } : x
        );
        pushHistory({ ...state, images: nextImages });
      },
      [pushHistory, state, contentSize]
    );

    const removeImage = useCallback(
      (id: string) => {
        const next = {
          ...state,
          images: state.images.filter((i) => i.id !== id),
        };
        pushHistory(next);
        if (selectedImageId === id) setSelectedImageId(null);
      },
      [pushHistory, selectedImageId, state]
    );

    const getContentPointFromClient = useCallback(
      (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = contentSize.w / rect.width;
        const scaleY = contentSize.h / rect.height;
        const px = (clientX - rect.left) * scaleX;
        const py = (clientY - rect.top) * scaleY;
        const angle = radians(state.rotationDeg);
        const centerX = contentSize.w / 2;
        const centerY = contentSize.h / 2;
        const dx = px - centerX;
        const dy = py - centerY;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        const cx = rx + contentSize.w / 2;
        const cy = ry + contentSize.h / 2;
        return { x: cx, y: cy };
      },
      [state.rotationDeg, contentSize]
    );

    const measureText = useCallback((t: TextItem) => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return { w: 0, h: t.size };
      ctx.font = `${t.size}px ${t.font}`;
      const w = ctx.measureText(t.text || " ").width;
      const h = t.size;
      return { w, h };
    }, []);

    const hitTestTextLocal = useCallback(
      (pt: { x: number; y: number }, t: TextItem) => {
        const { w, h } = measureText(t);
        const cx = t.x + w / 2;
        const cy = t.y - h / 2;
        const angle = radians(t.rotationDeg ?? 0);
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
        const within =
          lx >= -w / 2 && lx <= w / 2 && ly >= -h / 2 && ly <= h / 2;
        const rotateHandle = { x: 0, y: -h / 2 - 16, r: 8 };
        const resizeHandle = { x: w / 2, y: h / 2, r: 10 };
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
          setEditingTextId(hit?.id ?? null);
          if (hit && hitKind && hitData) {
            const t = state.texts.find((x) => x.id === hit.id)!;
            const { cx, cy, w, h } = hitData;
            if (hitKind === "drag") {
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
          setSelectedImageId(null);
          setEditingTextId(null);
          transformRef.current = null;
        }
      },
      [
        activeTool,
        brushColor,
        brushSize,
        getContentPointFromClient,
        hitTestTextLocal,
        state.texts,
        hitTestImage,
        state.images,
      ]
    );

    const onCanvasPointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        const pt = getContentPointFromClient(e.clientX, e.clientY);
        if (!pt) return;
        if (activeTool === "image") {
          const tf = transformRef.current;
          if (!tf || tf.target !== "image") return;
          if (tf.mode === "drag") {
            const it = state.images.find((x) => x.id === tf.id);
            if (!it) return;
            const newX = Math.max(
              0,
              Math.min(contentSize.w - it.w, pt.x - (tf.offsetX ?? 0))
            );
            const newY = Math.max(
              0,
              Math.min(contentSize.h - it.h, pt.y - (tf.offsetY ?? 0))
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
            const dx = Math.max(16, pt.x - it.x);
            const dy = Math.max(16, pt.y - it.y);
            const scale = Math.max(
              0.1,
              Math.min(10, Math.min(dx / startW, dy / startH))
            );
            const newW = Math.max(16, Math.round(startW * scale));
            const newH = Math.max(16, Math.round(startH * scale));
            const clampedW = Math.min(newW, contentSize.w - it.x);
            const clampedH = Math.min(newH, contentSize.h - it.y);
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
            if (!t) return;
            const h = t.size;
            const newX = Math.max(
              0,
              Math.min(contentSize.w, pt.x - (tf.offsetX ?? 0))
            );
            const newY = Math.max(
              h,
              Math.min(contentSize.h, pt.y - (tf.offsetY ?? 0) + h)
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
            const { h } = measureText(t);
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
        getContentPointFromClient,
        measureText,
        state.images,
        state.texts,
        contentSize,
      ]
    );

    const onCanvasPointerUp = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (
          activeTool === "image" ||
          activeTool === "text" ||
          activeTool === "draw"
        ) {
          if (transformRef.current || drawingRef.current) {
            transformRef.current = null;
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
        const files = e.currentTarget.files;
        if (!files || files.length === 0) {
          if (imagesInputRef.current) imagesInputRef.current.value = "";
          return;
        }
        const inputEl = e.currentTarget;
        const toLoad: Promise<ImageItem | null>[] = [];
        for (const file of Array.from(files)) {
          const url = URL.createObjectURL(file);
          toLoad.push(
            new Promise((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                const maxW = contentSize.w;
                const maxH = contentSize.h;
                const scale = Math.min(
                  maxW / img.naturalWidth,
                  maxH / img.naturalHeight,
                  0.5
                );
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
                const x = Math.round((maxW - w) / 2);
                const y = Math.round((maxH - h) / 2);
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
      [pushHistory, state, contentSize]
    );

    const drawBaseCanvas = useCallback(
      (drawGuides: boolean) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = contentSize.w;
        canvas.height = contentSize.h;
        ctx.fillStyle = "#f8f8f8";
        ctx.fillRect(0, 0, contentSize.w, contentSize.h);
        if (!image || !imageNatural) {
          ctx.fillStyle = "#666666";
          ctx.font = "14px Fredoka One";
          ctx.fillText("Upload an image or GIF to start", 16, 28);
          return;
        }
        ctx.save();
        ctx.translate(contentSize.w / 2, contentSize.h / 2);
        ctx.rotate(radians(state.rotationDeg));
        ctx.fillStyle = state.bgColor;
        ctx.fillRect(
          -contentSize.w / 2,
          -contentSize.h / 2,
          contentSize.w,
          contentSize.h
        );
        const { x, y, w, h } = getImageBounds();
        ctx.drawImage(
          image,
          x - contentSize.w / 2,
          y - contentSize.h / 2,
          w,
          h
        );
        for (const it of state.images) {
          const el = imageMapRef.current.get(it.id);
          if (el) {
            ctx.drawImage(
              el,
              it.x - contentSize.w / 2,
              it.y - contentSize.h / 2,
              it.w,
              it.h
            );
          }
          if (drawGuides && selectedImageId === it.id) {
            ctx.save();
            ctx.strokeStyle = "#3b82f6";
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(
              it.x - contentSize.w / 2,
              it.y - contentSize.h / 2,
              it.w,
              it.h
            );
            ctx.setLineDash([]);
            ctx.fillStyle = "#3b82f6";
            ctx.fillRect(
              it.x + it.w - contentSize.w / 2 - 6,
              it.y + it.h - contentSize.h / 2 - 6,
              12,
              12
            );
            ctx.restore();
          }
        }
        for (const t of state.texts) {
          const { w, h } = measureText(t);
          const cx = t.x - contentSize.w / 2 + w / 2;
          const cy = t.y - contentSize.h / 2 - h / 2;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(radians(t.rotationDeg ?? 0));
          ctx.fillStyle = t.color;
          ctx.textBaseline = "middle";
          ctx.font = `${t.size}px ${t.font}`;
          ctx.fillText(t.text || " ", -w / 2, 0);
          if (drawGuides && t.id === selectedTextId) {
            ctx.strokeStyle = "#ef4444";
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(-w / 2, -h / 2, w, h);
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(0, -h / 2 - 16, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#ef4444";
            ctx.fill();
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(w / 2 - 6, h / 2 - 6, 12, 12);
          }
          ctx.restore();
        }
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        for (const s of state.strokes) {
          if (s.points.length < 2) {
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(
              s.points[0].x - contentSize.w / 2,
              s.points[0].y - contentSize.h / 2,
              s.size / 2,
              0,
              Math.PI * 2
            );
            ctx.fill();
            continue;
          }
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.size;
          ctx.beginPath();
          ctx.moveTo(
            s.points[0].x - contentSize.w / 2,
            s.points[0].y - contentSize.h / 2
          );
          for (let i = 1; i < s.points.length; i++) {
            ctx.lineTo(
              s.points[i].x - contentSize.w / 2,
              s.points[i].y - contentSize.h / 2
            );
          }
          ctx.stroke();
        }
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
        getImageBounds,
      ]
    );

    const getDataURL = useCallback(
      (type: "png" | "jpeg") => {
        const canvas = canvasRef.current;
        if (!canvas) return "";
        const { w, h } = getImageBounds();
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const offCtx = off.getContext("2d")!;
        offCtx.fillStyle = state.bgColor;
        offCtx.fillRect(0, 0, w, h);
        if (image) {
          offCtx.drawImage(image, 0, 0, w, h);
        }
        for (const it of state.images) {
          const el = imageMapRef.current.get(it.id);
          if (el) {
            const relX = it.x;
            const relY = it.y;
            if (
              relX >= 0 &&
              relX + it.w <= w &&
              relY >= 0 &&
              relY + it.h <= h
            ) {
              offCtx.drawImage(el, relX, relY, it.w, it.h);
            }
          }
        }
        for (const t of state.texts) {
          const { w: tw, h: th } = measureText(t);
          const cx = t.x + tw / 2;
          const cy = t.y - th / 2;
          if (
            cx - tw / 2 >= 0 &&
            cx + tw / 2 <= w &&
            cy - th / 2 >= 0 &&
            cy + th / 2 <= h
          ) {
            offCtx.save();
            offCtx.translate(cx, cy);
            offCtx.rotate(radians(t.rotationDeg ?? 0));
            offCtx.fillStyle = t.color;
            offCtx.textBaseline = "middle";
            offCtx.font = `${t.size}px ${t.font}`;
            offCtx.fillText(t.text || " ", -tw / 2, 0);
            offCtx.restore();
          }
        }
        offCtx.lineJoin = "round"; // Changed from ctx to offCtx
        offCtx.lineCap = "round"; // Changed from ctx to offCtx
        for (const s of state.strokes) {
          const pointsInBounds = s.points.filter(
            (p) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h
          );
          if (pointsInBounds.length < 1) continue;
          if (pointsInBounds.length === 1) {
            offCtx.fillStyle = s.color; // Changed from ctx to offCtx
            offCtx.beginPath(); // Changed from ctx to offCtx
            offCtx.arc(
              // Changed from ctx to offCtx
              pointsInBounds[0].x,
              pointsInBounds[0].y,
              s.size / 2,
              0,
              Math.PI * 2
            );
            offCtx.fill(); // Changed from ctx to offCtx
          } else {
            offCtx.strokeStyle = s.color; // Changed from ctx to offCtx
            offCtx.lineWidth = s.size; // Changed from ctx to offCtx
            offCtx.beginPath(); // Changed from ctx to offCtx
            offCtx.moveTo(pointsInBounds[0].x, pointsInBounds[0].y); // Changed from ctx to offCtx
            for (let i = 1; i < pointsInBounds.length; i++) {
              offCtx.lineTo(pointsInBounds[i].x, pointsInBounds[i].y); // Changed from ctx to offCtx
            }
            offCtx.stroke(); // Changed from ctx to offCtx
          }
        }
        return off.toDataURL(`image/${type}`);
      },
      [image, state, measureText, getImageBounds]
    );

    const download = useCallback(
      (type: "png" | "jpeg") => {
        const dataURL = getDataURL(type);
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = `canvas-editor.${type}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
      [getDataURL]
    );

    const onCanvasWheel = useCallback(
      (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (activeTool === "image" && selectedImageId) {
          const factor = e.deltaY > 0 ? 0.95 : 1.05;
          scaleImage(selectedImageId, factor);
        } else if (activeTool === "text" && selectedTextId) {
          const t = state.texts.find((x) => x.id === selectedTextId);
          if (!t) return;
          const factor = e.deltaY > 0 ? 0.95 : 1.05;
          const newSize = Math.max(
            8,
            Math.min(256, Math.round(t.size * factor))
          );
          updateText(t.id, { size: newSize });
        }
      },
      [
        activeTool,
        selectedImageId,
        selectedTextId,
        state.texts,
        scaleImage,
        updateText,
      ]
    );

    const getSelectedText = useCallback(() => {
      return state.texts.find((t) => t.id === selectedTextId) || null;
    }, [selectedTextId, state.texts]);

    const getSelectedImage = useCallback(() => {
      return state.images.find((i) => i.id === selectedImageId) || null;
    }, [selectedImageId, state.images]);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (!image) return;
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
        if (e.key === "Escape") {
          setSelectedTextId(null);
          setSelectedImageId(null);
          setEditingTextId(null);
          return;
        }
        const step = e.shiftKey ? 10 : 1;
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
            removeImage(it.id);
            return;
          }
        }
        if (selectedTextId) {
          const t = stateRef.current.texts.find((x) => x.id === selectedTextId);
          if (!t) return;
          let { x, y } = t;
          const h = t.size;
          if (e.key === "ArrowLeft") x = Math.max(0, x - step);
          if (e.key === "ArrowRight") x = Math.min(contentSize.w, x + step);
          if (e.key === "ArrowUp") y = Math.max(h, y - step);
          if (e.key === "ArrowDown") y = Math.min(contentSize.h, y + step);
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
          if (e.key === "Delete" || (e.key === "Backspace" && !editingTextId)) {
            e.preventDefault();
            removeText(t.id);
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
      pushHistory,
      editingTextId,
      removeText,
      removeImage,
      contentSize,
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
        setBrushColor: (color: string) => setBrushColor(color),
        setBrushSize: (size: number) => setBrushSize(size),
        addText,
        updateText,
        removeText,
        clearStrokes,
        rotateBy,
        undo,
        redo,
        downloadPNG: () => download("png"),
        downloadJPEG: () => download("jpeg"),
        loadTemplate,
        getDataURL,
        scaleImage,
        bringForwardImage,
        sendBackwardImage,
        resetImageSize,
        getSelectedText,
        getSelectedImage,
        removeImage,
      }),
      [
        addText,
        updateText,
        removeText,
        clearStrokes,
        rotateBy,
        undo,
        redo,
        download,
        loadTemplate,
        getDataURL,
        scaleImage,
        bringForwardImage,
        sendBackwardImage,
        resetImageSize,
        getSelectedText,
        getSelectedImage,
        removeImage,
      ]
    );

    const getTextInputPosition = useCallback(
      (text: TextItem) => {
        if (!canvasRef.current) return { top: 0, left: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const { w, h } = measureText(text);
        const angle = radians(state.rotationDeg + (text.rotationDeg ?? 0));
        const cx = text.x + w / 2;
        const cy = text.y - h / 2;
        const canvasCenterX = contentSize.w / 2;
        const canvasCenterY = contentSize.h / 2;
        const dx = cx - canvasCenterX;
        const dy = cy - canvasCenterY;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const screenX = dx * cos - dy * sin + canvasCenterX;
        const screenY = dx * sin + dy * cos + canvasCenterY;
        const scaleX = rect.width / contentSize.w;
        const scaleY = rect.height / contentSize.h;
        return {
          left: rect.left + screenX * scaleX - (w * scaleX) / 2,
          top: rect.top + screenY * scaleY - (h * scaleY) / 2,
        };
      },
      [measureText, state.rotationDeg, contentSize]
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
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Base Image
                </span>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="w-auto cursor-pointer"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={activeTool === "text" ? "default" : "secondary"}
                onClick={() => setActiveTool("text")}
                disabled={!image}
                title="Add and edit text"
              >
                Text
              </Button>
              <Button
                variant={activeTool === "draw" ? "default" : "secondary"}
                onClick={() => setActiveTool("draw")}
                disabled={!image}
                title="Draw freehand"
              >
                Draw
              </Button>
              <Button
                variant={activeTool === "image" ? "default" : "secondary"}
                onClick={() => setActiveTool("image")}
                disabled={!image}
                title="Add overlay images"
              >
                Images
              </Button>
              <Button
                variant={activeTool === "rotate" ? "default" : "secondary"}
                onClick={() => setActiveTool("rotate")}
                disabled={!image}
                title="Rotate canvas"
              >
                Rotate
              </Button>
              <Button
                variant={activeTool === "download" ? "default" : "secondary"}
                onClick={() => setActiveTool("download")}
                disabled={!image}
                title="Download image"
              >
                Download
              </Button>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={undo}
                disabled={!image || !canUndo}
                title="Undo last action"
              >
                Undo
              </Button>
              <Button
                variant="outline"
                onClick={redo}
                disabled={!image || !canRedo}
                title="Redo last action"
              >
                Redo
              </Button>
              <Button
                variant="ghost"
                onClick={reset}
                disabled={!image}
                title="Reset canvas"
              >
                Reset
              </Button>
            </div>
          </div>
        )}
        <div
          className={cn(
            "relative w-full overflow-auto rounded-md border bg-muted/50",
            "flex items-center justify-center"
          )}
          style={{ width: contentSize.w, height: contentSize.h }}
        >
          <canvas
            ref={canvasRef}
            className={cn(
              "block touch-none",
              activeTool === "draw"
                ? "cursor-crosshair"
                : activeTool === "text" || activeTool === "image"
                ? "cursor-move"
                : "cursor-default"
            )}
            width={contentSize.w}
            height={contentSize.h}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onWheel={onCanvasWheel}
            style={{
              border: "1px solid #ccc",
              boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            }}
          />
          {editingTextId && (
            <div
              className="absolute"
              style={{
                ...getTextInputPosition(
                  state.texts.find((t) => t.id === editingTextId)!
                ),
              }}
            >
              <Input
                value={state.texts.find((t) => t.id === editingTextId)!.text}
                onChange={(e) => {
                  const text = e.currentTarget.value;
                  setState((prev) => ({
                    ...prev,
                    texts: prev.texts.map((t) =>
                      t.id === editingTextId ? { ...t, text } : t
                    ),
                  }));
                }}
                onBlur={() => {
                  setEditingTextId(null);
                  pushHistory(stateRef.current);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    setEditingTextId(null);
                    pushHistory(stateRef.current);
                  }
                }}
                autoFocus
                style={{
                  fontFamily: "Fredoka One",
                  fontSize: `${
                    state.texts.find((t) => t.id === editingTextId)!.size
                  }px`,
                  color: state.texts.find((t) => t.id === editingTextId)!.color,
                  border: "1px solid #ef4444",
                  background: "rgba(255, 255, 255, 0.9)",
                  padding: "2px 4px",
                  minWidth: "50px",
                }}
              />
            </div>
          )}
        </div>
      </section>
    );
  }
);

CanvasEditor.displayName = "CanvasEditor";

export default CanvasEditor;

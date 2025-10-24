// /app/generate/page.tsx
"use client";

import { Suspense } from "react";
import MemeGeneratorInner from "./MemeGeneratorInner";

export default function MemeGeneratorPage() {
  return (
    <Suspense fallback={<div>Loading Meme Generator...</div>}>
      <MemeGeneratorInner />
    </Suspense>
  );
}

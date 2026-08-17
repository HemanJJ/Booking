"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function CourtGallery({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-xl bg-slate-200 text-slate-400">
        無圖片
      </div>
    );
  }

  const go = (delta: number) =>
    setIdx((i) => (i + delta + images.length) % images.length);

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-200">
        <Image
          src={images[idx]}
          alt="場地照片"
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-cover"
          priority
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="上一張"
              className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-xl text-white hover:bg-black/70"
            >
              ‹
            </button>
            <button
              onClick={() => go(1)}
              aria-label="下一張"
              className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-xl text-white hover:bg-black/70"
            >
              ›
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setIdx(i)}
              className={cn(
                "relative h-14 w-20 shrink-0 overflow-hidden rounded-md",
                i === idx
                  ? "ring-2 ring-emerald-500"
                  : "opacity-60 hover:opacity-100"
              )}
            >
              <Image
                src={src}
                alt={`縮圖 ${i + 1}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

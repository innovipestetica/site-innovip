"use client";

import { useState } from "react";

function youtubeId(value: string): string | null {
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0] ?? "")) return parts[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function YoutubeVideo({ url, title, aspect = "16:9" }: {
  url: string;
  title?: string;
  aspect?: "16:9" | "9:16" | "1:1";
}) {
  const id = youtubeId(url);
  const [playing, setPlaying] = useState(false);
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
  const ratio = aspect === "9:16" ? "aspect-[9/16] max-w-md" : aspect === "1:1" ? "aspect-square max-w-2xl" : "aspect-video max-w-5xl";
  const params = new URLSearchParams({ rel: "0", playsinline: "1", modestbranding: "1", autoplay: "1" });
  return (
    <div className={`relative mx-auto w-full overflow-hidden rounded-[var(--radius-card)] bg-black shadow-lg ${ratio}`}>
      {playing ? (
        <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?${params}`}
          title={title || "Vídeo do YouTube"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
      ) : (
        <button type="button" onClick={() => setPlaying(true)}
          className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white hover:bg-neutral-900 focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-white">
          <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-full bg-white text-3xl text-black">▶</span>
          <span className="text-lg font-semibold">Assistir com som</span>
        </button>
      )}
    </div>
  );
}

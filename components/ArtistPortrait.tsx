"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { artistImageUrl } from "@/lib/images/artist";
export function ArtistPortrait({ name, hint }: { name: string; hint?:string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      fetch(`/api/artist-image?name=${encodeURIComponent(name)}&hint=${encodeURIComponent(hint || "musician")}&v=2`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data) => {
          if (!controller.signal.aborted) setUrl(artistImageUrl(data.url));
        })
        .catch(() => {});
    });
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [name, hint]);
  return (
    <div
      ref={ref}
      className="absolute inset-0 flex items-center justify-center text-teal"
    >
      {url ? (
        <Image
          src={url}
          alt={name}
          fill
          sizes="56px"
          className="object-cover"
          onError={() => setUrl(null)}
        />
      ) : (
        <span aria-hidden="true">♪</span>
      )}
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faSpinner, faX } from "@fortawesome/free-solid-svg-icons";
import { updateAvatarFile } from "@/app/(app)/profile/actions";

export function AvatarEditor({
  currentUrl,
  displayName,
}: {
  currentUrl?: string | null;
  displayName: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Máximo 2MB");
      return;
    }

    setUploading(true);
    setError(null);

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const base64 = btoa(String.fromCharCode(...uint8));
      const dataUrl = `data:${file.type};base64,${base64}`;

      await updateAvatarFile(dataUrl, file.type);
      setPreview(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Error subiendo imagen");
      setPreview(null);
    }
    setUploading(false);
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className="relative">
      <div className="relative w-20 h-20 border-2 border-teal overflow-hidden bg-[var(--color-surface-alt)]">
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt={displayName}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-teal font-bold text-2xl">
            {displayName.charAt(0)}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 w-7 h-7 bg-teal flex items-center justify-center text-white hover:bg-teal/80 transition-colors"
          title="Cambiar foto"
        >
          {uploading ? (
            <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
          ) : (
            <FontAwesomeIcon icon={faCamera} className="text-xs" />
          )}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {error && (
        <div className="absolute top-full left-0 mt-2 z-20 card p-2 w-56">
          <div className="flex items-center justify-between">
            <p className="text-red-500 text-xs">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-muted hover:text-[var(--color-text)]"
            >
              <FontAwesomeIcon icon={faX} className="text-[10px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

export function BackButton({
  fallbackHref = "/search",
  label = "Volver",
}: {
  fallbackHref?: string;
  label?: string;
}) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-2 text-muted text-sm mb-6 hover:text-teal transition-colors bg-transparent border-0 cursor-pointer"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
      <span>{label}</span>
    </button>
  );
}
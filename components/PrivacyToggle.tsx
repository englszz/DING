"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe, faLock } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/client";

export function PrivacyToggle({ currentPrivacy }: { currentPrivacy: string }) {
  const [privacy, setPrivacy] = useState<"public" | "private">(
    currentPrivacy as "public" | "private"
  );
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    const next = privacy === "public" ? "private" : "public";
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ privacy: next, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      setPrivacy(next);
      router.refresh();
    }
    setSaving(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className="w-9 h-9 flex items-center justify-center border border-[var(--color-border)] hover:border-teal transition-colors text-muted hover:text-teal flex-shrink-0"
      title={privacy === "public" ? "Público" : "Privado"}
    >
      <FontAwesomeIcon icon={privacy === "public" ? faGlobe : faLock} className="text-sm" />
    </button>
  );
}

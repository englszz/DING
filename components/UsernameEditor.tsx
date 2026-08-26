"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faCheck, faSpinner, faX } from "@fortawesome/free-solid-svg-icons";
import { updateUsername } from "@/app/(app)/profile/actions";

export function UsernameEditor({ currentUsername }: { currentUsername: string }) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(currentUsername);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateUsername(username);
      setEditing(false);
      router.push(`/profile/${result.username}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Error saving username");
    }
    setSaving(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted hover:text-teal transition-colors"
        title="Editar username"
      >
        <FontAwesomeIcon icon={faPen} className="text-xs" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted text-sm font-medium">@</span>
      <input
        type="text"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
          setError(null);
        }}
        className="form-input text-sm py-1 px-2"
        style={{ width: "160px" }}
        autoFocus
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || username === currentUsername}
        className="btn btn-primary text-xs py-1 px-2"
      >
        {saving ? (
          <FontAwesomeIcon icon={faSpinner} spin />
        ) : (
          <FontAwesomeIcon icon={faCheck} />
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setUsername(currentUsername);
          setError(null);
        }}
        className="text-muted hover:text-[var(--color-text)]"
      >
        <FontAwesomeIcon icon={faX} className="text-xs" />
      </button>
      {error && (
        <p className="text-red-500 text-xs absolute mt-8">{error}</p>
      )}
    </div>
  );
}

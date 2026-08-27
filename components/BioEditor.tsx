"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import { updateBio } from "@/app/(app)/profile/actions";

interface BioEditorProps {
  currentBio?: string;
}

export function BioEditor({ currentBio }: BioEditorProps) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(currentBio || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBio(bio.trim());
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setEditing(false);
      }, 1200);
    } catch (e: any) {
      alert(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-2">
        {currentBio ? (
          <p className="text-[var(--color-text)] text-sm">{currentBio}</p>
        ) : (
          <p className="text-muted text-xs italic">Agregar descripción...</p>
        )}
        <button
          onClick={() => setEditing(true)}
          className="text-muted hover:text-teal transition-colors mt-1"
        >
          <FontAwesomeIcon icon={faPenToSquare} className="text-xs" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={300}
        rows={3}
        placeholder="Cuéntanos sobre ti..."
        className="form-input text-sm py-2 resize-none"
      />
      <p className="text-muted text-xs mt-1">{bio.length}/300</p>
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary text-xs py-1.5 px-3"
        >
          {saved ? (
            <>
              <FontAwesomeIcon icon={faCheck} /> Guardado
            </>
          ) : saving ? (
            "Guardando..."
          ) : (
            "Guardar"
          )}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setBio(currentBio || "");
          }}
          className="btn btn-ghost text-xs py-1.5 px-3"
        >
          <FontAwesomeIcon icon={faXmark} /> Cancelar
        </button>
      </div>
    </div>
  );
}

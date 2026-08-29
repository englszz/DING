"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGlobe,
  faPenToSquare,
  faCheck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import {
  faInstagram,
  faXTwitter,
  faFacebook,
} from "@fortawesome/free-brands-svg-icons";
import { updateSocialLinks } from "@/app/(app)/profile/actions";

const PLATFORMS = [
  {
    key: "website_url" as const,
    label: "Sitio web",
    icon: faGlobe,
    placeholder: "https://tusitio.com",
    validate: (v: string) => /^https?:\/\/.+/.test(v),
    error: "Debe comenzar con http:// o https://",
  },
  {
    key: "instagram_url" as const,
    label: "Instagram",
    icon: faInstagram,
    placeholder: "https://instagram.com/usuario",
    validate: (v: string) => /instagram\.com\/[\w.]+/.test(v),
    error: "Debe ser un enlace de instagram.com",
  },
  {
    key: "twitter_url" as const,
    label: "X / Twitter",
    icon: faXTwitter,
    placeholder: "https://x.com/usuario",
    validate: (v: string) => /(x\.com|twitter\.com)\/[\w]+/.test(v),
    error: "Debe ser un enlace de x.com o twitter.com",
  },
  {
    key: "facebook_url" as const,
    label: "Facebook",
    icon: faFacebook,
    placeholder: "https://facebook.com/usuario",
    validate: (v: string) => /facebook\.com\/[\w.]+/.test(v),
    error: "Debe ser un enlace de facebook.com",
  },
] as const;

interface SocialEditorProps {
  websiteUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  editable?: boolean;
}

export function SocialEditor({
  websiteUrl,
  instagramUrl,
  twitterUrl,
  facebookUrl,
  editable = true,
}: SocialEditorProps) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({
    website_url: websiteUrl || "",
    instagram_url: instagramUrl || "",
    twitter_url: twitterUrl || "",
    facebook_url: facebookUrl || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasAnyLink = websiteUrl || instagramUrl || twitterUrl || facebookUrl;

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSave() {
    const newErrors: Record<string, string> = {};
    for (const p of PLATFORMS) {
      const val = values[p.key];
      if (val && !p.validate(val)) {
        newErrors[p.key] = p.error;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await updateSocialLinks(values);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setEditing(false);
      }, 1200);
    } catch (e: any) {
      setErrors({ _general: e.message || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="inline-flex items-center gap-2 flex-wrap">
        {hasAnyLink ? (
          <>
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center border border-[var(--color-border)] hover:border-teal transition-colors"
              >
                <FontAwesomeIcon icon={faGlobe} className="text-[var(--color-accent-2)] text-sm" />
              </a>
            )}
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center border border-[var(--color-border)] hover:border-teal transition-colors"
              >
                <FontAwesomeIcon icon={faInstagram} className="text-[var(--color-accent-2)] text-sm" />
              </a>
            )}
            {twitterUrl && (
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center border border-[var(--color-border)] hover:border-teal transition-colors"
              >
                <FontAwesomeIcon icon={faXTwitter} className="text-[var(--color-accent-2)] text-sm" />
              </a>
            )}
            {facebookUrl && (
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center border border-[var(--color-border)] hover:border-teal transition-colors"
              >
                <FontAwesomeIcon icon={faFacebook} className="text-[var(--color-accent-2)] text-sm" />
              </a>
            )}
          </>
        ) : (
          <p className="text-muted text-xs">Sin enlaces sociales</p>
        )}
        {editable && (
          <button
            onClick={() => setEditing(true)}
            className="w-9 h-9 flex items-center justify-center border border-[var(--color-border)] hover:border-teal transition-colors text-muted hover:text-teal"
          >
            <FontAwesomeIcon icon={faPenToSquare} className="text-sm" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
      <p className="text-xs font-bold uppercase text-muted mb-3 tracking-wider">
        Agregar links
      </p>
      <div className="space-y-3">
        {PLATFORMS.map((p) => (
          <div key={p.key}>
            <label className="text-xs font-medium text-muted flex items-center gap-2 mb-1">
              <FontAwesomeIcon icon={p.icon} className="text-[var(--color-accent-2)]" />
              {p.label}
            </label>
            <input
              type="url"
              value={values[p.key]}
              onChange={(e) => handleChange(p.key, e.target.value)}
              placeholder={p.placeholder}
              className="form-input text-sm py-2"
            />
            {errors[p.key] && (
              <p className="text-red-500 text-xs mt-1">{errors[p.key]}</p>
            )}
          </div>
        ))}
      </div>
      {errors._general && (
        <p className="text-red-500 text-xs mt-2">{errors._general}</p>
      )}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary text-xs py-2 px-4"
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
            setErrors({});
          }}
          className="btn btn-ghost text-xs py-2 px-4"
        >
          <FontAwesomeIcon icon={faXmark} /> Cancelar
        </button>
      </div>
    </div>
  );
}

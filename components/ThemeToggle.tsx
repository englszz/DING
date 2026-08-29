"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ding-theme");
    const initial = saved
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute(
      "data-theme",
      initial ? "dark" : "light"
    );
    setDark(initial);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute(
      "data-theme",
      next ? "dark" : "light"
    );
    localStorage.setItem("ding-theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="w-9 h-9 flex items-center justify-center border border-gray hover:border-teal transition-colors text-muted hover:text-teal"
      title={dark ? "Modo claro" : "Modo oscuro"}
    >
      <FontAwesomeIcon icon={dark ? faSun : faMoon} className="text-sm" />
    </button>
  );
}

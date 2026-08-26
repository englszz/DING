"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("ding-theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("ding-theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn btn-ghost text-xs"
      style={{ padding: "6px 12px", border: "1px solid var(--color-border-subtle)" }}
      title={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      aria-label="Cambiar tema"
    >
      <FontAwesomeIcon icon={theme === "light" ? faMoon : faSun} className="text-primary text-sm" />
      <span className="hidden sm:inline font-medium">
        {theme === "light" ? "Oscuro" : "Claro"}
      </span>
    </button>
  );
}

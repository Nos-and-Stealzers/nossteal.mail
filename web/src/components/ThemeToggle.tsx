"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "./icons";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost btn-sm"
      aria-label="Toggle theme"
      title="Toggle light / dark"
    >
      {dark ? <Sun width={16} height={16} /> : <Moon width={16} height={16} />}
    </button>
  );
}

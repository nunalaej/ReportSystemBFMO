"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeToDocument(t: Theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Remove both then add current
  root.classList.remove("light", "dark");
  root.classList.add(t);

  // Update custom properties so body uses correct colors
  if (t === "light") {
    root.style.setProperty("--background", "#ffffff");
    root.style.setProperty("--foreground", "#171717");
  } else {
    root.style.setProperty("--background", "#0a0a0a");
    root.style.setProperty("--foreground", "#ededed");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // On mount, read from localStorage or prefers-color-scheme
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem("bfmo_theme");
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
      applyThemeToDocument(stored);
      return;
    }

    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const initial: Theme = prefersDark ? "dark" : "light";
    setThemeState(initial);
    applyThemeToDocument(initial);
  }, []);

  // Anytime theme changes, apply to document and store
  useEffect(() => {
    if (typeof window === "undefined") return;
    applyThemeToDocument(theme);
    window.localStorage.setItem("bfmo_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  const value: ThemeContextValue = {
    theme,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}

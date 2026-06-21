import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useData } from "./DataContext";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useData();

  const [theme, setThemeState] = useState<Theme>(() => {
    // Default to dark; will be synced from settings when available
    return 'dark';
  });

  // Sync when persisted settings change (e.g., user updated theme elsewhere)
  useEffect(() => {
    const persisted = settings?.theme as Theme | undefined;
    if (persisted && persisted !== theme) setThemeState(persisted);
  }, [settings?.theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (updateSettings) updateSettings({ theme: next });
      return next;
    });
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (updateSettings) updateSettings({ theme: newTheme });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

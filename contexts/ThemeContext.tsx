import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type ViewMode = 'default' | 'desktop';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  viewMode: ViewMode;
  toggleViewMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => { },
  setTheme: () => { },
  viewMode: 'default',
  toggleViewMode: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize from localStorage or default
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_theme');
      return (saved as Theme) || 'dark';
    }
    return 'dark';
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_view_mode');
      return (saved as ViewMode) || 'default';
    }
    return 'default';
  });

  // Apply Theme to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  // Apply View Mode (Optional: could add a class to body if needed for global CSS overrides)
  useEffect(() => {
    localStorage.setItem('app_view_mode', viewMode);
    // Example: document.body.classList.toggle('desktop-mode', viewMode === 'desktop');
  }, [viewMode]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (newTheme: Theme) => setThemeState(newTheme);

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'default' ? 'desktop' : 'default');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, viewMode, toggleViewMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

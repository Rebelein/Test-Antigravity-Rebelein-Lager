import React, { createContext, useContext, useEffect, useState } from 'react';

type ViewMode = 'default' | 'desktop';
type AppTheme = 'default' | 'glass' | 'glass-light';

interface ThemeContextType {
  viewMode: ViewMode;
  toggleViewMode: () => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  viewMode: 'default',
  toggleViewMode: () => { },
  theme: 'default',
  setTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_view_mode');
      return (saved as ViewMode) || 'default';
    }
    return 'default';
  });

  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_theme_style');
      return (saved as AppTheme) || 'default';
    }
    return 'default';
  });

  // Apply Theme to HTML element
  useEffect(() => {
    const root = window.document.documentElement;

    // Handle light/dark mode classes
    if (theme === 'glass-light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }

    // Apply theme data attribute for CSS styling
    root.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme_style', theme);
  }, [theme]);

  // Apply View Mode
  useEffect(() => {
    localStorage.setItem('app_view_mode', viewMode);
  }, [viewMode]);

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'default' ? 'desktop' : 'default');
  };

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ viewMode, toggleViewMode, theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

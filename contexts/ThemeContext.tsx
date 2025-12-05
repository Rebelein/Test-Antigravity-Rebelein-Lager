import React, { createContext, useContext, useEffect, useState } from 'react';

type ViewMode = 'default' | 'desktop';

interface ThemeContextType {
  viewMode: ViewMode;
  toggleViewMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  viewMode: 'default',
  toggleViewMode: () => { },
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

  // Apply Theme to HTML element (Always Dark)
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.add('dark');
    // Ensure light mode is never active
    root.classList.remove('light');
    localStorage.setItem('app_theme', 'dark');
  }, []);

  // Apply View Mode (Optional: could add a class to body if needed for global CSS overrides)
  useEffect(() => {
    localStorage.setItem('app_view_mode', viewMode);
    // Example: document.body.classList.toggle('desktop-mode', viewMode === 'desktop');
  }, [viewMode]);

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'default' ? 'desktop' : 'default');
  };

  return (
    <ThemeContext.Provider value={{ viewMode, toggleViewMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

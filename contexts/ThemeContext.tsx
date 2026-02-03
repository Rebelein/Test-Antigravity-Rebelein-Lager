import React, { createContext, useContext, useEffect, useState } from 'react';

type ViewMode = 'default' | 'desktop';
type AppTheme = 'default' | 'glass';

interface ThemeContextType {
  viewMode: ViewMode;
  toggleViewMode: () => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  isLowPerfMode: boolean;
  toggleLowPerfMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  viewMode: 'default',
  toggleViewMode: () => { },
  theme: 'default',
  setTheme: () => { },
  isLowPerfMode: false,
  toggleLowPerfMode: () => { },
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

    // Enforce dark mode always
    root.classList.add('dark');
    root.classList.remove('light');

    // Apply theme data attribute for CSS styling
    // If saved theme was glass-light (legacy), force it to glass
    const effectiveTheme = (theme as string) === 'glass-light' ? 'glass' : theme;

    root.setAttribute('data-theme', effectiveTheme);
    localStorage.setItem('app_theme_style', effectiveTheme);
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

  // Performance Mode (Default: ON for all devices)
  // Users can opt-in to premium effects by disabling this mode
  const [isLowPerfMode, setIsLowPerfMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedValue = localStorage.getItem('rebelein-low-perf-mode');

      // If user has explicitly set a preference, use it
      if (savedValue !== null) {
        return savedValue === 'true';
      }

      // Default: Performance mode ON for all devices
      // Users can disable to get premium blur/animation effects
      return true;
    }
    return true;
  });

  const toggleLowPerfMode = () => {
    setIsLowPerfMode(prev => {
      const newValue = !prev;
      localStorage.setItem('rebelein-low-perf-mode', String(newValue));
      return newValue;
    });
  };

  // Apply Low Perf Mode class
  useEffect(() => {
    const root = window.document.documentElement;
    if (isLowPerfMode) {
      root.classList.add('low-perf-mode');
    } else {
      root.classList.remove('low-perf-mode');
    }
  }, [isLowPerfMode]);

  return (
    <ThemeContext.Provider value={{ viewMode, toggleViewMode, theme, setTheme, isLowPerfMode, toggleLowPerfMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

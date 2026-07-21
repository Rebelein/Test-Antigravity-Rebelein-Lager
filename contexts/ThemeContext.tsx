import React, { createContext, useContext, useEffect, useState } from 'react';

type ViewMode = 'default' | 'desktop';
type AppTheme = 'default' | 'glass';
type ColorMode = 'light' | 'dark';

interface ThemeContextType {
  viewMode: ViewMode;
  toggleViewMode: () => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  colorMode: ColorMode;
  toggleColorMode: () => void;
  isDark: boolean;
  isLowPerfMode: boolean;
  toggleLowPerfMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  viewMode: 'default',
  toggleViewMode: () => { },
  theme: 'default',
  setTheme: () => { },
  colorMode: 'dark',
  toggleColorMode: () => { },
  isDark: true,
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

  // Color Mode: light or dark
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_color_mode');
      return (saved as ColorMode) || 'dark';
    }
    return 'dark';
  });

  const isDark = colorMode === 'dark';

  // Apply Color Mode + Theme to HTML element
  useEffect(() => {
    const root = window.document.documentElement;

    if (colorMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    // Update theme-color meta tag dynamically for PWA status bar matching
    const themeColorMeta = window.document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', colorMode === 'dark' ? '#0b0f19' : '#EDF1F5');
    }

    // Apply theme data attribute for CSS styling
    // If saved theme was glass-light (legacy), force it to glass
    const effectiveTheme = (theme as string) === 'glass-light' ? 'glass' : theme;

    root.setAttribute('data-theme', effectiveTheme);
    localStorage.setItem('app_theme_style', effectiveTheme);
    localStorage.setItem('app_color_mode', colorMode);
  }, [theme, colorMode]);

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

  const toggleColorMode = () => {
    setColorMode(prev => {
      const newMode = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app_color_mode', newMode);
      return newMode;
    });
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

  const value = React.useMemo(() => ({
    viewMode,
    toggleViewMode,
    theme,
    setTheme,
    colorMode,
    toggleColorMode,
    isDark,
    isLowPerfMode,
    toggleLowPerfMode
  }), [viewMode, theme, colorMode, isDark, isLowPerfMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

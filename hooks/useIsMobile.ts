import { useState, useEffect } from 'react';

export const useIsMobile = (breakpoint = 768): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // Media Query für Mobileräte
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

    // Initialer Check
    setIsMobile(mediaQuery.matches);

    // Event Listener für Änderungen
    const handler = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    // Modernere API für Listener (Safari support beachten, aber matchMedia ist breit unterstützt)
    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [breakpoint]);

  return isMobile;
};

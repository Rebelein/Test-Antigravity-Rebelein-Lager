import { useState, useEffect } from 'react';

export type DeviceMode = 'smartphone' | 'tablet_portrait' | 'tablet_landscape' | 'desktop';
export type DeviceOverride = 'auto' | DeviceMode;

export interface DeviceModeInfo {
  mode: DeviceMode;
  override: DeviceOverride;
  isMobile: boolean;
  isTabletPortrait: boolean;
  isTabletLandscape: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  screenWidth: number;
  screenHeight: number;
  setOverride: (override: DeviceOverride) => void;
}

export const detectDeviceMode = (width: number, height: number): DeviceMode => {
  const isPortrait = height >= width;

  if (width < 768) {
    return 'smartphone';
  } else if (width >= 768 && width <= 1180) {
    return isPortrait ? 'tablet_portrait' : 'tablet_landscape';
  } else {
    // Width > 1180
    if (width <= 1280 && isPortrait) {
      return 'tablet_portrait';
    }
    return 'desktop';
  }
};

const OVERRIDE_STORAGE_KEY = 'rebelein_device_mode_override';

export const useDeviceMode = (): DeviceModeInfo => {
  const [override, setOverrideState] = useState<DeviceOverride>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(OVERRIDE_STORAGE_KEY);
      if (saved && ['auto', 'smartphone', 'tablet_portrait', 'tablet_landscape', 'desktop'].includes(saved)) {
        return saved as DeviceOverride;
      }
    }
    return 'auto';
  });

  const [deviceInfo, setDeviceInfo] = useState<{
    detectedMode: DeviceMode;
    orientation: 'portrait' | 'landscape';
    width: number;
    height: number;
  }>(() => {
    if (typeof window === 'undefined') {
      return { detectedMode: 'desktop', orientation: 'landscape', width: 1440, height: 900 };
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      detectedMode: detectDeviceMode(w, h),
      orientation: h >= w ? 'portrait' : 'landscape',
      width: w,
      height: h,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setDeviceInfo({
        detectedMode: detectDeviceMode(w, h),
        orientation: h >= w ? 'portrait' : 'landscape',
        width: w,
        height: h,
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const setOverride = (newOverride: DeviceOverride) => {
    setOverrideState(newOverride);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(OVERRIDE_STORAGE_KEY, newOverride);
    }
  };

  const activeMode: DeviceMode = override === 'auto' ? deviceInfo.detectedMode : override;

  return {
    mode: activeMode,
    override,
    isMobile: activeMode === 'smartphone',
    isTabletPortrait: activeMode === 'tablet_portrait',
    isTabletLandscape: activeMode === 'tablet_landscape',
    isTablet: activeMode === 'tablet_portrait' || activeMode === 'tablet_landscape',
    isDesktop: activeMode === 'desktop',
    orientation: deviceInfo.orientation,
    screenWidth: deviceInfo.width,
    screenHeight: deviceInfo.height,
    setOverride,
  };
};

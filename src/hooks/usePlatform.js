import { useState, useEffect } from 'react';

/**
 * usePlatform — Detects device type, OS, and display mode.
 * Returns reactive breakpoint flags that update on resize.
 */
export default function usePlatform() {
  const [platform, setPlatform] = useState(() => ({
    isMobile:  window.innerWidth < 768,
    isTablet:  window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
    isIOS:     /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    isPWA:     window.matchMedia('(display-mode: standalone)').matches,
    isTouchDevice: window.matchMedia('(hover: none) and (pointer: coarse)').matches
  }));

  useEffect(() => {
    const update = () => setPlatform(prev => ({
      ...prev,
      isMobile:  window.innerWidth < 768,
      isTablet:  window.innerWidth >= 768 && window.innerWidth < 1024,
      isDesktop: window.innerWidth >= 1024
    }));

    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);

  return platform;
}

import { useState, useEffect } from 'react';

export function useMobile() {
  const [state, setState] = useState(() => {
    const ua = navigator.userAgent;
    const w  = window.innerWidth;
    return {
      isMobile:  w < 768,
      isIOS:     /iPad|iPhone|iPod/.test(ua) && !window.MSStream,
      isAndroid: /Android/.test(ua),
      isPWA:     window.matchMedia('(display-mode: standalone)').matches ||
                 window.navigator.standalone === true,
    };
  });

  useEffect(() => {
    function update() {
      setState(s => ({ ...s, isMobile: window.innerWidth < 768 }));
    }
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);

  return state;
}

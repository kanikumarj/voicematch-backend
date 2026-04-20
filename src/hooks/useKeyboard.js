import { useState, useEffect } from 'react';

/**
 * Detects virtual keyboard open/close via visualViewport.
 * Returns `keyboardHeight` in px (0 when closed).
 */
export function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) return;

    const vp = window.visualViewport;

    function onResize() {
      const heightDiff = window.innerHeight - vp.height;
      setKeyboardHeight(Math.max(0, heightDiff - vp.offsetTop));
    }

    vp.addEventListener('resize', onResize, { passive: true });
    vp.addEventListener('scroll', onResize, { passive: true });
    return () => {
      vp.removeEventListener('resize', onResize);
      vp.removeEventListener('scroll', onResize);
    };
  }, []);

  return { keyboardHeight, isKeyboardOpen: keyboardHeight > 100 };
}

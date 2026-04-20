/**
 * Returns CSS environment safe-area inset values.
 * Useful for manually computing layout offsets.
 */
export function useSafeArea() {
  // We expose them as CSS var()-based strings so components
  // can use them directly in inline styles.
  return {
    top:    'env(safe-area-inset-top,    0px)',
    bottom: 'env(safe-area-inset-bottom, 0px)',
    left:   'env(safe-area-inset-left,   0px)',
    right:  'env(safe-area-inset-right,  0px)',
  };
}

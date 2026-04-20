import { useEffect, useRef } from 'react';
import './BottomSheet.css';

export default function BottomSheet({ open, onClose, title, children }) {
  const sheetRef = useRef(null);
  const startY   = useRef(null);

  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  // Swipe-down to dismiss
  function onTouchStart(e) {
    startY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    if (startY.current === null) return;
    const delta = e.changedTouches[0].clientY - startY.current;
    if (delta > 60) onClose();
    startY.current = null;
  }

  // Trap focus
  useEffect(() => {
    if (open) {
      sheetRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="bs-backdrop" onClick={handleBackdrop} aria-modal="true" role="dialog">
      <div
        className="bs-sheet"
        ref={sheetRef}
        tabIndex={-1}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="bs-handle" aria-hidden="true" />
        {title && <h3 className="bs-title">{title}</h3>}
        <div className="bs-content">{children}</div>
      </div>
    </div>
  );
}

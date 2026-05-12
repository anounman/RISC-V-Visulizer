/**
 * useResize — Drag-to-resize hook
 *
 * Returns a ref to attach to the drag handle element and the current size.
 * direction: 'horizontal' = controls width of the left panel
 *            'vertical'   = controls height of the top panel
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export function useResize(
  initial: number,
  direction: 'horizontal' | 'vertical',
  min = 80,
  max = Infinity,
) {
  const [size, setSize] = useState(initial);
  const dragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(initial);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSize.current = size;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction, size]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const pos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = pos - startPos.current;
      const next = Math.max(min, Math.min(max, startSize.current + delta));
      setSize(next);
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [direction, min, max]);

  return { size, onMouseDown };
}

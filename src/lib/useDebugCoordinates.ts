import { useRef, useState, useCallback, type MouseEvent } from "react";

export interface ClickMark {
  x: number;
  y: number;
  id: number;
}

export interface DebugCoordinates {
  containerRef: React.RefObject<HTMLDivElement | null>;
  cursor: { x: number; y: number } | null;
  clickMarks: ClickMark[];
  handleMouseMove: (e: MouseEvent<HTMLDivElement>) => void;
  handleClick: (e: MouseEvent<HTMLDivElement>) => void;
  handleMouseLeave: () => void;
}

export function useDebugCoordinates(): DebugCoordinates {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [clickMarks, setClickMarks] = useState<ClickMark[]>([]);
  const markId = useRef(0);

  const calcPercent = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    return { x: fx * 100, y: fy * 100 };
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      setCursor(calcPercent(e.clientX, e.clientY));
    },
    [calcPercent],
  );

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const pos = calcPercent(e.clientX, e.clientY);
      if (!pos) return;
      const id = ++markId.current;
      setClickMarks((prev) => [...prev, { x: pos.x, y: pos.y, id }]);
      window.setTimeout(() => {
        setClickMarks((prev) => prev.filter((m) => m.id !== id));
      }, 6000);
    },
    [calcPercent],
  );

  const handleMouseLeave = useCallback(() => {
    setCursor(null);
  }, []);

  return {
    containerRef,
    cursor,
    clickMarks,
    handleMouseMove,
    handleClick,
    handleMouseLeave,
  };
}

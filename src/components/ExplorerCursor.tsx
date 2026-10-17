import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Cursor states: "explorer" over the scene, "drag" while actively dragging,
// "discover" over a hotspot. Hotspots opt in via useExplorerCursor().
export type ExplorerCursorState = "explorer" | "drag" | "discover";

interface ExplorerCursorControls {
  setDiscover: (active: boolean) => void;
  setDragging: (active: boolean) => void;
}

const ExplorerCursorContext = createContext<ExplorerCursorControls | null>(null);

export function useExplorerCursor(): ExplorerCursorControls | null {
  return useContext(ExplorerCursorContext);
}

const FOLLOW = 0.4; // lerp factor; 1 = instant

function CompassGlyph({ dragging }: { dragging: boolean }) {
  // Subtle ring with four ticks; while dragging the ticks become small
  // directional arrows to suggest movement in every direction. A defined
  // translucent dark outline keeps the glyph crisp on any photograph —
  // bright sky, white clouds, dark rock, or vegetation.
  const ink = "rgba(246,238,220,0.97)";
  const inkSoft = "rgba(246,238,220,0.92)";
  const edge = "rgba(18,14,9,0.55)";
  const ringR = 8;
  const tickInner = 9.6;
  const tickOuter = dragging ? 12.2 : 11.2;
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle
        cx="13"
        cy="13"
        r={ringR}
        stroke={edge}
        strokeWidth="3.4"
        style={{ opacity: dragging ? 0.3 : 1 }}
      />
      <circle
        cx="13"
        cy="13"
        r={ringR}
        stroke={ink}
        strokeWidth="1.7"
        style={{ opacity: dragging ? 0.35 : 1 }}
      />
      {directions.map(({ dx, dy }, i) => {
        const px = 13 + dx * tickInner;
        const py = 13 + dy * tickInner;
        const qx = 13 + dx * tickOuter;
        const qy = 13 + dy * tickOuter;
        const wx = dy * 1.7;
        const wy = dx * 1.7;
        return dragging ? (
          <g key={i}>
            <path
              d={`M ${qx + wx} ${qy + wy} L ${px} ${py} L ${qx - wx} ${qy - wy}`}
              stroke={edge}
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={`M ${qx + wx} ${qy + wy} L ${px} ${py} L ${qx - wx} ${qy - wy}`}
              stroke={ink}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ) : (
          <g key={i}>
            <line
              x1={px}
              y1={py}
              x2={qx}
              y2={qy}
              stroke={edge}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <line
              x1={px}
              y1={py}
              x2={qx}
              y2={qy}
              stroke={inkSoft}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
        );
      })}
      <circle cx="13" cy="13" r="1.2" fill={ink} />
      <circle cx="13" cy="13" r="2.4" fill={edge} />
    </svg>
  );
}

function MagnifierGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="rgba(240,230,210,0.95)"
        strokeWidth="1.4"
      />
      <line
        x1="15.8"
        y1="15.8"
        x2="21"
        y2="21"
        stroke="rgba(240,230,210,0.95)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface ExplorerCursorProps {
  children: ReactNode;
}

// Global explorer cursor. Mount once per scene; the scene's photo area must
// set `cursor: none` (helper below) and hotspots call useExplorerCursor().
export default function ExplorerCursor({ children }: ExplorerCursorProps) {
  const [state, setState] = useState<ExplorerCursorState>("explorer");
  const [visible, setVisible] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -100, y: -100 });
  const targetPos = useRef({ x: -100, y: -100 });
  const raf = useRef(0);
  const running = useRef(false);
  const stateRef = useRef<ExplorerCursorState>("explorer");
  stateRef.current = state;

  const controls = useMemo<ExplorerCursorControls>(
    () => ({
      setDiscover: (active) =>
        setState((prev) => (active ? "discover" : prev === "discover" ? "explorer" : prev)),
      setDragging: (active) =>
        setState((prev) => (active ? "drag" : prev === "drag" ? "explorer" : prev)),
    }),
    [],
  );

  const startLoop = useCallback(() => {
    if (running.current) return;
    running.current = true;
    const step = () => {
      const el = elRef.current;
      if (!el) {
        running.current = false;
        return;
      }
      const dx = targetPos.current.x - pos.current.x;
      const dy = targetPos.current.y - pos.current.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        pos.current = { ...targetPos.current };
        el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
        running.current = false;
        return;
      }
      pos.current.x += dx * FOLLOW;
      pos.current.y += dy * FOLLOW;
      el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    // Touch devices keep their native behavior: no custom cursor at all.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onMove = (e: MouseEvent) => {
      const overNative =
        (e.target as HTMLElement | null)?.closest("button, a, [data-native-cursor]") !=
        null;
      targetPos.current = { x: e.clientX, y: e.clientY };
      if (overNative) {
        setVisible(false);
        return;
      }
      const el = elRef.current;
      if (!el) return;
      if (!visible || reduced) {
        // Snap instead of gliding on first appearance or for reduced motion.
        pos.current = { ...targetPos.current };
        el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
      } else {
        startLoop();
      }
      setVisible(true);
    };
    const onLeave = () => setVisible(false);
    const onVisibility = () => {
      if (document.hidden) setVisible(false);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(raf.current);
      running.current = false;
    };
  }, [startLoop, visible]);

  return (
    <ExplorerCursorContext.Provider value={controls}>
      {children}
      <div
        ref={elRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[100]"
        style={{
          transform: "translate3d(-100px, -100px, 0)",
          opacity: visible ? 1 : 0,
          transition: "opacity 180ms ease",
          willChange: "transform",
        }}
      >
        <div
          style={{
            transform: `translate(-50%, -50%) scale(${state === "drag" ? 1.12 : 1})`,
            transition: "transform 160ms ease",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.55))",
          }}
        >
          {state === "discover" ? <MagnifierGlyph /> : <CompassGlyph dragging={state === "drag"} />}
        </div>
      </div>
    </ExplorerCursorContext.Provider>
  );
}

// Style for the scene's photo area: hides the native cursor on fine-pointer
// devices; the custom explorer cursor takes over. Falls back to a system
// cursor on touch devices / when the custom cursor is not running.
export const explorerCursorHide = {
  cursor: "none",
};

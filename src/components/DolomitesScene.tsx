import { useCallback, useEffect, useRef, useState } from "react";
import { DebugOverlay } from "@/components/DebugOverlay";
import ExplorerCursor, {
  useExplorerCursor,
  explorerCursorHide,
} from "@/components/ExplorerCursor";
import type { ClickMark } from "@/lib/useDebugCoordinates";

import TempBlackbirdBehavior from "@/components/TempBlackbirdBehavior";

const DOLOMITES_IMAGE = "/dolomites-italy.jpg";
const LOCATION_NAME = "Dolomites, Italy";
// Extra size over the "cover the viewport" minimum, so there is always
// room to drag in both directions.
const OVERSCAN = 1.3;
const SMOOTHING = 0.22;
const DRAG_THRESHOLD = 6;
const BLACKBIRD_POSITION = { x: 67.07, y: 63.34 };

// The photo is visually translated by half of its own size to be centred in
// its drag container. Convert photo percentages to that container's origin.
function photoCoordinate(percent: number, size: number): number {
  return (percent / 100 - 0.5) * size;
}

interface DolomitesSceneProps {
  onWorldMapSelect: () => void;
}

export default function DolomitesScene({ onWorldMapSelect }: DolomitesSceneProps) {
  return (
    <ExplorerCursor>
      <DolomitesSceneInner onWorldMapSelect={onWorldMapSelect} />
    </ExplorerCursor>
  );
}

function DolomitesSceneInner({ onWorldMapSelect }: DolomitesSceneProps) {
  const cursor = useExplorerCursor();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const rafId = useRef<number | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const panLimit = useRef({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);
  const pointerLast = useRef<{ x: number; y: number; t: number } | null>(null);
  const pointerVelocity = useRef({ x: 0, y: 0 });
  const momentum = useRef({ x: 0, y: 0 });
  const lastTickTime = useRef<number | null>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const [ready, setReady] = useState(false);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [debugCursor, setDebugCursor] = useState<{ x: number; y: number } | null>(null);
  const [debugMarks, setDebugMarks] = useState<ClickMark[]>([]);
  const markIdRef = useRef(0);

  const clampPan = useCallback(() => {
    target.current.x = Math.max(
      -panLimit.current.x,
      Math.min(panLimit.current.x, target.current.x),
    );
    target.current.y = Math.max(
      -panLimit.current.y,
      Math.min(panLimit.current.y, target.current.y),
    );
  }, []);

  useEffect(() => {
    const tick = (time: number) => {
      if (lastTickTime.current !== null) {
        const dt = Math.min((time - lastTickTime.current) / 16.7, 4);
        // Momentum glide after release, decaying smoothly.
        if (momentum.current.x !== 0 || momentum.current.y !== 0) {
          target.current.x += momentum.current.x * dt;
          target.current.y += momentum.current.y * dt;
          momentum.current.x *= Math.pow(0.92, dt);
          momentum.current.y *= Math.pow(0.92, dt);
          if (Math.abs(momentum.current.x) < 0.1) momentum.current.x = 0;
          if (Math.abs(momentum.current.y) < 0.1) momentum.current.y = 0;
          clampPan();
        }
        const stepX = (target.current.x - current.current.x) * SMOOTHING * dt;
        const stepY = (target.current.y - current.current.y) * SMOOTHING * dt;
        current.current.x += stepX;
        current.current.y += stepY;
        const el = containerRef.current;
        if (el) {
          el.style.transform = `translate(${current.current.x}px, ${current.current.y}px)`;
        }
      }
      lastTickTime.current = time;
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [clampPan]);

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    // Smallest size that covers the viewport with no letterboxing, then
    // scaled up so there is slack to drag in both directions. The image's
    // own aspect ratio is never touched.
    const coverScale = Math.max(viewportW / img.naturalWidth, viewportH / img.naturalHeight);
    const scale = coverScale * OVERSCAN;
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    setImgSize({ width, height });
    panLimit.current = {
      x: Math.max(0, (width - viewportW) / 2),
      y: Math.max(0, (height - viewportH) / 2),
    };
    target.current.x = Math.max(
      -panLimit.current.x,
      Math.min(panLimit.current.x, target.current.x),
    );
    target.current.y = Math.max(
      -panLimit.current.y,
      Math.min(panLimit.current.y, target.current.y),
    );
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, ready]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cursor?.setDragging(true);
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerLast.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    pointerVelocity.current = { x: 0, y: 0 };
    momentum.current = { x: 0, y: 0 };
    downPos.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId || !pointerLast.current) return;
    const now = performance.now();
    const dx = e.clientX - pointerLast.current.x;
    const dy = e.clientY - pointerLast.current.y;
    const dt = Math.max(1, now - pointerLast.current.t);
    // Track finger/mouse velocity for the gentle glide on release.
    pointerVelocity.current = {
      x: pointerVelocity.current.x * 0.7 + (-dx / dt) * 16.7 * 0.3,
      y: pointerVelocity.current.y * 0.7 + (-dy / dt) * 16.7 * 0.3,
    };
    pointerLast.current = { x: e.clientX, y: e.clientY, t: now };
    const down = downPos.current;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_THRESHOLD) {
      moved.current = true;
    }
    target.current.x += -dx;
    target.current.y += -dy;
    clampPan();
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    // Keep the glide gentle: clamp the release velocity.
    const cap = 18;
    const vx = Math.max(-cap, Math.min(cap, pointerVelocity.current.x));
    const vy = Math.max(-cap, Math.min(cap, pointerVelocity.current.y));
    if (Math.abs(vx) > 0.5) momentum.current.x = vx;
    if (Math.abs(vy) > 0.5) momentum.current.y = vy;
    cursor?.setDragging(false);
    pointerId.current = null;
    pointerLast.current = null;
  };

  useEffect(() => {
    const preventTouchScroll = (e: TouchEvent) => {
      if (e.touches.length > 0) e.preventDefault();
    };
    document.addEventListener("touchmove", preventTouchScroll, { passive: false });
    return () => document.removeEventListener("touchmove", preventTouchScroll);
  }, []);

  const calcDebugPercent = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleSceneMouseMove = (e: React.MouseEvent) => {
    if (!import.meta.env.DEV) return;
    setDebugCursor(calcDebugPercent(e.clientX, e.clientY));
  };

  const handleSceneClick = (e: React.MouseEvent) => {
    if (!import.meta.env.DEV) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (moved.current) return;
    const pos = calcDebugPercent(e.clientX, e.clientY);
    if (!pos) return;
    const id = ++markIdRef.current;
    setDebugMarks((prev) => [...prev, { x: pos.x, y: pos.y, id }]);
    window.setTimeout(() => {
      setDebugMarks((prev) => prev.filter((m) => m.id !== id));
    }, 6000);
  };

  const handleSceneMouseLeave = () => {
    setDebugCursor(null);
  };

  return (
    <div
      className="relative h-[100dvh] w-screen overflow-hidden bg-black"
      onMouseMove={handleSceneMouseMove}
      onClick={handleSceneClick}
      onMouseLeave={handleSceneMouseLeave}
      style={{ touchAction: "none", ...explorerCursorHide }}
    >
      {/* Full-bleed photograph, oversized past the viewport so it can be
          dragged in every direction; CSS transforms keep the motion smooth. */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="absolute left-1/2 top-1/2 will-change-transform"
        style={{ transform: "translate(0px, 0px)", ...explorerCursorHide }}
      >
        <img
          ref={imgRef}
          src={DOLOMITES_IMAGE}
          alt="Dolomites mountain landscape in Italy"
          className={`block select-none transition-opacity duration-1000 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
          style={{
            maxWidth: "none",
            transform: "translate(-50%, -50%)",
          }}
          draggable={false}
          onLoad={async (event) => {
            const image = event.currentTarget;
            try {
              await image.decode();
            } catch {
              // ignore
            }
            measure();
            setReady(true);
          }}
        />

        {/* Animated blackbird — pinned to the photograph so it pans
            with the scene. Positioned at 67.07% / 63.34% of the image. */}
        {ready && imgSize.width > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0"
            style={{ zIndex: 40 }}
          >
            <TempBlackbirdBehavior
              left={`${photoCoordinate(BLACKBIRD_POSITION.x, imgSize.width)}px`}
              top={`${photoCoordinate(BLACKBIRD_POSITION.y, imgSize.height)}px`}
            />
          </div>
        )}

        {/* Dev-only marker layer, pinned to the full photograph so markers
            stay on their image spot while the scene is dragged. */}
        {import.meta.env.DEV && ready && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0"
            style={{ zIndex: 60 }}
          >
            {debugMarks.map((m) => (
              <div
                key={m.id}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${photoCoordinate(m.x, imgRef.current?.width ?? 0)}px`,
                  top: `${photoCoordinate(m.y, imgRef.current?.height ?? 0)}px`,
                }}
              >
                <div className="absolute left-1/2 top-0 h-[40px] w-px -translate-x-1/2 -translate-y-1/2 bg-fuchsia-400/80" />
                <div className="absolute top-1/2 left-0 h-px w-[40px] -translate-x-1/2 -translate-y-1/2 bg-fuchsia-400/80" />
                <div className="absolute left-[14px] top-0 whitespace-nowrap rounded bg-fuchsia-500/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-lg">
                  X: {m.x.toFixed(2)}% Y: {m.y.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barely-there vignette to match the other scenes. */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.28) 100%), radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.18) 100%)",
          opacity: ready ? 1 : 0,
        }}
      />

      {/* Bottom navigation bar, same style as the other scenes. */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center"
        style={{
          background: "rgba(12, 14, 10, 0.32)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <nav
          className="flex items-center gap-[clamp(1.5rem,5vw,4rem)] py-[0.6rem] font-sans text-[clamp(0.58rem,1.5vw,0.72rem)] uppercase tracking-[0.18em] text-[#e8dcc8]/70"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
        >
          <button
            type="button"
            onClick={onWorldMapSelect}
            className="whitespace-nowrap cursor-pointer transition-colors hover:text-[#e8dcc8]/90"
          >
            World Map
          </button>
        </nav>
      </div>

      {/* Dev-only cursor readout, matching the other scenes. */}
      {import.meta.env.DEV && (
        <DebugOverlay cursor={debugCursor} clickMarks={[]} label={LOCATION_NAME} />
      )}
    </div>
  );
}

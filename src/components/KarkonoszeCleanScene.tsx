import { useCallback, useEffect, useRef, useState } from "react";
import ExplorerCursor, {
  useExplorerCursor,
  explorerCursorHide,
} from "@/components/ExplorerCursor";

const KARKONOSZE_IMAGE = "/karkonosze-forest.webp";
// Extra size over the "cover the viewport" minimum, so there is always
// room to drag in both directions.
const OVERSCAN = 1.3;
const SMOOTHING = 0.22;
const DRAG_THRESHOLD = 6;

interface KarkonoszeCleanSceneProps {
  onWorldMapSelect: () => void;
}

export default function KarkonoszeCleanScene({
  onWorldMapSelect,
}: KarkonoszeCleanSceneProps) {
  return (
    <ExplorerCursor>
      <KarkonoszeCleanSceneInner onWorldMapSelect={onWorldMapSelect} />
    </ExplorerCursor>
  );
}

function KarkonoszeCleanSceneInner({
  onWorldMapSelect,
}: KarkonoszeCleanSceneProps) {
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
  const moved = useRef(false);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);

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
    const coverScale = Math.max(
      viewportW / img.naturalWidth,
      viewportH / img.naturalHeight,
    );
    const scale = coverScale * OVERSCAN;
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
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
    if (
      down &&
      Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_THRESHOLD
    ) {
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
    document.addEventListener("touchmove", preventTouchScroll, {
      passive: false,
    });
    return () =>
      document.removeEventListener("touchmove", preventTouchScroll);
  }, []);

  return (
    <div
      className="relative h-[100dvh] w-screen overflow-hidden bg-black"
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
          src={KARKONOSZE_IMAGE}
          alt="Misty forest path in the Karkonosze Mountains"
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
      </div>

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
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { DebugOverlay } from "@/components/DebugOverlay";
import type { ClickMark } from "@/lib/useDebugCoordinates";

const GLENCoe_IMAGE = "/glencoe-scotland.jpg";
const LOCATION_NAME = "Glencoe, Scotland";
const SMOOTHING = 0.085;
const SNAP_SPEED = 0.5;
// Initial viewport sits near the middle of the photograph (main mountain
// and hillside), expressed as a fraction of the image's scrollable top offset.
const INITIAL_SCROLL_FRACTION = 0.47;
const MOBILE_BREAKPOINT = "(max-width: 767px)";
// On mobile the photo is sized from the viewport height (not width) so it
// fills the screen edge to edge; its sides may crop beyond the viewport.
const MOBILE_IMAGE_HEIGHT_VH = 180;
interface GlencoeSceneProps {
  onWorldMapSelect: () => void;
}

export default function GlencoeScene({ onWorldMapSelect }: GlencoeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetY = useRef(0);
  const currentY = useRef(0);
  const velocity = useRef(0);
  const lastTickTime = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const panTarget = useRef(0);
  const panCurrent = useRef(0);
  const velocityX = useRef(0);
  const panLimitRef = useRef(0);
  const pointerId = useRef<number | null>(null);
  const pointerLast = useRef<{ x: number; y: number; t: number } | null>(null);
  const pointerVelocity = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const [debugCursor, setDebugCursor] = useState<{ x: number; y: number } | null>(null);
  const [debugMarks, setDebugMarks] = useState<ClickMark[]>([]);
  const markIdRef = useRef(0);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const [imageHeight, setImageHeight] = useState(0);
  const [imageW, setImageW] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [ready, setReady] = useState(false);
  const [scrollRatio, setScrollRatio] = useState(0);
  const ratioRef = useRef(0);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(MOBILE_BREAKPOINT).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia(MOBILE_BREAKPOINT);
    const handleChange = () => setIsMobile(query.matches);
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const maxScroll = Math.max(0, imageHeight - window.innerHeight);

  const clampTarget = useCallback(
    (value: number) => Math.max(0, Math.min(maxScroll, value)),
    [maxScroll],
  );

  // Horizontal pan is stored relative to the centered position, so it
  // ranges symmetrically within the crop margin on either side.
  const clampPan = useCallback(
    (value: number) =>
      Math.max(-panLimitRef.current, Math.min(panLimitRef.current, value)),
    [],
  );

  useEffect(() => {
    const tick = (time: number) => {
      if (lastTickTime.current !== null) {
        const dt = Math.min((time - lastTickTime.current) / 16.7, 4);
        // Touch momentum: glide after the finger lifts, decaying smoothly.
        if (velocity.current !== 0) {
          targetY.current = clampTarget(
            targetY.current + velocity.current * dt,
          );
          velocity.current *= Math.pow(0.94, dt);
          if (Math.abs(velocity.current) < 0.15) velocity.current = 0;
        }
        if (velocityX.current !== 0) {
          panTarget.current = clampPan(
            panTarget.current + velocityX.current * dt,
          );
          velocityX.current *= Math.pow(0.94, dt);
          if (Math.abs(velocityX.current) < 0.15) velocityX.current = 0;
        }
        const diff = targetY.current - currentY.current;
        const step = Math.abs(diff) < SNAP_SPEED
          ? diff
          : diff * SMOOTHING * dt;
        currentY.current += step;
        const diffX = panTarget.current - panCurrent.current;
        panCurrent.current += Math.abs(diffX) < SNAP_SPEED
          ? diffX
          : diffX * SMOOTHING * dt;
        const el = containerRef.current;
        if (el) {
          el.style.transform = `translate(${-panCurrent.current}px, ${
            -currentY.current
          }px)`;
        }
        const ratio = maxScroll > 0 ? currentY.current / maxScroll : 0;
        if (Math.abs(ratio - ratioRef.current) > 0.0005) {
          ratioRef.current = ratio;
          setScrollRatio(ratio);
        }
      }
      lastTickTime.current = time;
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [clampTarget, clampPan, maxScroll]);

  const requestScroll = useCallback(
    (delta: number) => {
      targetY.current = clampTarget(targetY.current + delta);
      velocity.current = 0;
      setShowHint(false);
    },
    [clampTarget],
  );

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Normalize: 1 wheel notch = 3 lines; pixels come through as-is.
      const delta =
        e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2
          ? e.deltaY * window.innerHeight
          : e.deltaY;
      requestScroll(delta * 0.9);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        requestScroll(e.key === "PageDown" ? window.innerHeight * 0.8 : 140);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        requestScroll(e.key === "PageUp" ? -window.innerHeight * 0.8 : -140);
      } else if (e.key === "Home") {
        e.preventDefault();
        requestScroll(-targetY.current);
      } else if (e.key === "End") {
        e.preventDefault();
        requestScroll(maxScroll - targetY.current);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [requestScroll, maxScroll]);

  const handlePointerDown = (e: React.PointerEvent) => {
    movedRef.current = false;
    downPosRef.current = { x: e.clientX, y: e.clientY };
    if (!isMobile || e.pointerType === "mouse") return;
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerLast.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    pointerVelocity.current = { x: 0, y: 0 };
    velocity.current = 0;
    velocityX.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId || !pointerLast.current) return;
    const now = performance.now();
    const dx = e.clientX - pointerLast.current.x;
    const dy = pointerLast.current.y - e.clientY;
    const dt = Math.max(1, now - pointerLast.current.t);
    // Track the finger's velocity for the momentum glide on release.
    pointerVelocity.current = {
      x: pointerVelocity.current.x * 0.7 + (-dx / dt) * 16.7 * 0.3,
      y: pointerVelocity.current.y * 0.7 + (dy / dt) * 16.7 * 0.3,
    };
    pointerLast.current = { x: e.clientX, y: e.clientY, t: now };
    const down = downPosRef.current;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
      movedRef.current = true;
    }
    // Content follows the finger one-to-one in both axes.
    panTarget.current = clampPan(panTarget.current - dx);
    requestScroll(dy);
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    if (Math.abs(pointerVelocity.current.y) > 0.5) {
      velocity.current = pointerVelocity.current.y;
    }
    if (Math.abs(pointerVelocity.current.x) > 0.5) {
      velocityX.current = pointerVelocity.current.x;
    }
    pointerId.current = null;
    pointerLast.current = null;
  };

  const measureImage = useCallback(() => {
    const img = containerRef.current?.querySelector("img");
    if (!img) return;
    const rect = img.getBoundingClientRect();
    setImageHeight(rect.height);
    setImageW(rect.width);
    panLimitRef.current = Math.max(0, rect.width - window.innerWidth) / 2;
  }, []);

  useEffect(() => {
    measureImage();
    window.addEventListener("resize", measureImage);
    return () => window.removeEventListener("resize", measureImage);
  }, [isMobile, measureImage]);

  useEffect(() => {
    targetY.current = clampTarget(targetY.current);
    panTarget.current = clampPan(panTarget.current);
  }, [clampTarget, clampPan, maxScroll]);

  // Dev-only helpers: percentages are measured against the full photograph
  // (its bounding box already carries the scroll/pan transform), so the
  // values stay image-relative no matter where the scene is dragged.
  const calcDebugPercent = useCallback(
    (clientX: number, clientY: number) => {
      const img = imgRef.current;
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return {
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
      };
    },
    [],
  );

  const handleSceneMouseMove = (e: React.MouseEvent) => {
    if (!import.meta.env.DEV) return;
    setDebugCursor(calcDebugPercent(e.clientX, e.clientY));
  };

  const handleSceneMouseDown = (e: React.MouseEvent) => {
    downPosRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
  };

  const handleSceneClick = (e: React.MouseEvent) => {
    if (!import.meta.env.DEV) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    const down = downPosRef.current;
    if (movedRef.current) return;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
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

  const trackPercent = Math.max(
    10,
    Math.min(60, (window.innerHeight / imageHeight) * 100),
  );

  return (
    <div
      className="relative h-[100dvh] w-screen overflow-hidden bg-black"
      onMouseMove={handleSceneMouseMove}
      onMouseDown={handleSceneMouseDown}
      onClick={handleSceneClick}
      onMouseLeave={handleSceneMouseLeave}
    >
      {/* Scrollable photograph layer. The image renders at full viewport width
          with its original aspect ratio; the layer translates smoothly so only
          a viewport-height slice is visible at any moment. */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={`absolute top-0 will-change-transform ${
          isMobile ? "left-1/2" : "left-0 w-full"
        }`}
        style={{
          transform: "translate(0px, 0px)",
          // Claim the gesture so the browser never scrolls the page itself.
          touchAction: isMobile ? "none" : "auto",
        }}
      >
        <img
          src={GLENCoe_IMAGE}
          alt="Rugged mountains and a valley in Glencoe, Scotland"
          className={`block select-none transition-opacity duration-1000 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
          style={
            isMobile
              ? {
                  // Scaled from viewport height at the photo's natural aspect
                  // ratio; deliberately allowed to be wider than the viewport,
                  // so the max-width cap from the base stylesheet must go.
                  height: `${MOBILE_IMAGE_HEIGHT_VH}dvh`,
                  width: "auto",
                  maxWidth: "none",
                  transform: "translateX(-50%)",
                }
              : { width: "100%", height: "auto" }
          }
          draggable={false}
          ref={imgRef}
          onLoad={async (event) => {
            const image = event.currentTarget;
            try {
              await image.decode();
            } catch {
              // ignore
            }
            const height = image.getBoundingClientRect().height;
            setImageHeight(height);
            measureImage();
            const max = Math.max(0, height - window.innerHeight);
            const start = Math.round(max * INITIAL_SCROLL_FRACTION);
            targetY.current = start;
            currentY.current = start;
            setReady(true);
          }}
        ></img>

        {/* Dev-only marker layer: sized to the full photograph so markers
            stay pinned to their image spot while the scene scrolls or pans. */}
        {import.meta.env.DEV && imageW > 0 && imageHeight > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0"
            style={{
              left: isMobile ? "50%" : "0",
              width: imageW,
              height: imageHeight,
              transform: isMobile ? "translateX(-50%)" : undefined,
              zIndex: 60,
            }}
          >
            {debugMarks.map((m) => (
              <div
                key={m.id}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
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

      {/* Barely-there vignette: keeps the eye inside the frame without
          announcing itself. */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.28) 100%), radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.18) 100%)",
          opacity: ready ? 1 : 0,
        }}
      />

      {/* First-visit hint, whispers once then disappears forever. */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center transition-opacity duration-1000 ${
          ready && showHint ? "opacity-100 delay-700" : "opacity-0"
        }`}
      >
        <p className="font-sans text-white/45 tracking-[0.3em] text-[clamp(0.55rem,1.4vw,0.68rem)] uppercase">
          Scroll to descend into the glen
        </p>
      </div>

      {/* Whisper-thin descent rail instead of a browser scrollbar. */}
      {maxScroll > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 z-20 h-[38vh] w-px -translate-y-1/2 bg-white/10"
        >
          <div
            className="absolute left-0 w-full rounded-full bg-[#c28b4b]/80 shadow-[0_0_4px_rgba(0,0,0,0.35)]"
            style={{
              height: `${trackPercent}%`,
              top: `${scrollRatio * (100 - trackPercent)}%`,
            }}
          />
        </div>
      )}

      {/* Bottom navigation bar */}
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
        <DebugOverlay
          cursor={debugCursor}
          clickMarks={[]}
          label={LOCATION_NAME}
        />
      )}
    </div>
  );
}
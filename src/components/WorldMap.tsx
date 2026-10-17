import { useRef, useState, useCallback, useEffect, type MouseEvent } from "react";
import { Plus, Minus, Lock } from "lucide-react";
import { LOCATIONS, type LocationId } from "@/lib/locations";

interface WorldMapProps {
  unlockedLocations: Set<LocationId>;
  onLocationSelect: (id: LocationId) => void;
}

const WORLD_MAP_IMAGE = "/world-map.jpg";

const KARKONOSZE_MARKER = { left: 47.65, top: 25.03, label: "Karkonosze Mountains" };

const ZOOM_STEPS = [1.0, 1.25, 1.5, 2.0];

interface ClickMark {
  x: number;
  y: number;
  id: number;
}

interface Pan {
  x: number;
  y: number;
}

export default function WorldMap({ unlockedLocations, onLocationSelect }: WorldMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [clickMarks, setClickMarks] = useState<ClickMark[]>([]);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const markId = useRef(0);

  const dragState = useRef({
    active: false,
    startMouseX: 0,
    startMouseY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const didDrag = useRef(false);

  const zoom = ZOOM_STEPS[zoomIndex];

  const clampPan = useCallback((px: number, py: number, z: number): Pan => {
    const el = mapRef.current;
    if (!el || z <= 1.0) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const maxX = ((z - 1) * rect.width) / 2;
    const maxY = ((z - 1) * rect.height) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, px)),
      y: Math.max(-maxY, Math.min(maxY, py)),
    };
  }, []);

  useEffect(() => {
    if (zoom <= 1.0) {
      setPan({ x: 0, y: 0 });
    } else {
      setPan((prev) => clampPan(prev.x, prev.y, zoom));
    }
  }, [zoom, clampPan]);

  const calcPercent = useCallback(
    (clientX: number, clientY: number) => {
      const el = mapRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const fx = (clientX - cx - pan.x) / (rect.width * zoom) + 0.5;
      const fy = (clientY - cy - pan.y) / (rect.height * zoom) + 0.5;
      return { x: fx * 100, y: fy * 100 };
    },
    [pan, zoom],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (zoom <= 1.0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      dragState.current = {
        active: true,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      didDrag.current = false;
      setIsDragging(true);
    },
    [zoom, pan],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (dragState.current.active) {
        const dx = e.clientX - dragState.current.startMouseX;
        const dy = e.clientY - dragState.current.startMouseY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
        setPan(
          clampPan(
            dragState.current.startPanX + dx,
            dragState.current.startPanY + dy,
            zoom,
          ),
        );
      }
      setCursor(calcPercent(e.clientX, e.clientY));
    },
    [calcPercent, clampPan, zoom],
  );

  const handleMouseUp = useCallback(() => {
    if (dragState.current.active) {
      dragState.current.active = false;
      setIsDragging(false);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (dragState.current.active) {
      dragState.current.active = false;
      setIsDragging(false);
    }
    setCursor(null);
  }, []);

  const handleMapClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (didDrag.current) return;
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

  const zoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1));
  }, []);
  const zoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(i - 1, 0));
  }, []);

  const viewportCursor = zoom <= 1.0 ? "default" : isDragging ? "grabbing" : "grab";

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[radial-gradient(circle_at_center,#173746_0%,#0b202b_48%,#040d14_100%)]">
      <div
        ref={mapRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleMapClick}
        className="absolute left-1/2 top-1/2 overflow-hidden"
        style={{
          width: "min(100vw, 150dvh)",
          height: "min(100dvh, 66.6667vw)",
          transform: "translate(-50%, -50%)",
          cursor: viewportCursor,
        }}
      >
        {/* Zoom layer: image + markers + crosshairs scale and pan together */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <img
            src={WORLD_MAP_IMAGE}
            alt="A world map"
            className="absolute inset-0 h-full w-full select-none"
            draggable={false}
          />
          {/* Location markers */}
          <button
            type="button"
            aria-label="Balkan Forest"
            onClick={() => onLocationSelect("karkonosze")}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none"
            style={{
              left: `${KARKONOSZE_MARKER.left}%`,
              top: `${KARKONOSZE_MARKER.top}%`,
              width: "48px",
              height: "48px",
            }}
          >
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c28b4b] shadow-[0_0_0_3px_rgba(194,139,75,0.25)]"
            />
            <span
              aria-hidden="true"
              className="absolute left-[calc(50%+18px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[13px] font-medium tracking-[0.08em] text-[#f1dfbf] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
            >
              Karkonosze Mountains
            </span>
          </button>
          {LOCATIONS.filter((location) => location.id !== "karkonosze").map(
            (location) => {
              const isUnlocked = unlockedLocations.has(location.id);
              return (
                <div
                  key={location.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${location.marker.left}%`,
                    top: `${location.marker.top}%`,
                    width: "48px",
                    height: "48px",
                  }}
                >
                  {isUnlocked ? (
                    <button
                      type="button"
                      aria-label={location.label}
                      onClick={() => onLocationSelect(location.id)}
                      className="absolute inset-0 cursor-pointer rounded-full outline-none"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c28b4b] shadow-[0_0_0_3px_rgba(194,139,75,0.25)]"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute left-[calc(50%+18px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[13px] font-medium tracking-[0.08em] text-[#f1dfbf] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                      >
                        {location.label}
                      </span>
                    </button>
                  ) : (
                    <div className="pointer-events-none absolute inset-0 opacity-60">
                      <span
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7c848c] shadow-[0_0_0_3px_rgba(124,132,140,0.2)]"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute left-[calc(50%+18px)] top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap"
                      >
                        <Lock
                          className="h-3 w-3 text-[#aab4bd]"
                          aria-hidden="true"
                        />
                        <span className="text-[13px] font-medium tracking-[0.08em] text-[#aab4bd] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                          {location.label}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              );
            },
          )}

          {/* Project signature over the Antarctic ice */}
          {/* Project signature over the Antarctic ice */}
<div
  aria-hidden="true"
  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 select-none italic font-medium"
  style={{
    left: "61.5%",
    top: "92.5%",
    fontSize: "clamp(1rem, 2vw, 1.5rem)",
    fontFamily: '"Alegreya", serif',
fontStyle: "italic",
fontWeight: 500,
    letterSpacing: "0.24em",
    color: "rgba(215, 222, 224, 0.92)",
textShadow:
  "1px 1px 1px rgba(255,255,255,0.95), -1px -1px 1px rgba(55,65,68,0.5), 0 2px 3px rgba(35,40,42,0.28)",
    transition: "color 250ms ease, text-shadow 250ms ease",
    cursor: "default",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.color = "rgba(248, 250, 250, 0.92)";
    e.currentTarget.style.textShadow =
      "1px 1px 1px rgba(255,255,255,0.95), -1px -1px 1px rgba(65,75,77,0.38), 0 2px 4px rgba(35,40,40,0.22)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.color = "rgba(235, 240, 241, 0.78)";
    e.currentTarget.style.textShadow =
      "1px 1px 1px rgba(255,255,255,0.85), -1px -1px 1px rgba(70,80,82,0.28), 0 2px 3px rgba(40,45,45,0.18)";
  }}
>
  Nature Alive
</div>

          {/* Debug click crosshairs */}
          {clickMarks.map((m) => (
            <div
              key={m.id}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${m.x}%`, top: `${m.y}%`, zIndex: 60 }}
            >
              <div className="absolute left-1/2 top-0 h-[40px] w-px -translate-x-1/2 -translate-y-1/2 bg-fuchsia-400/80" />
              <div className="absolute top-1/2 left-0 h-px w-[40px] -translate-x-1/2 -translate-y-1/2 bg-fuchsia-400/80" />
              <div className="absolute left-[14px] top-0 whitespace-nowrap rounded bg-fuchsia-500/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-lg">
                X: {m.x.toFixed(2)}% Y: {m.y.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>

        {/* Debug cursor readout (stays fixed in viewport corner) */}
        <div
          className="pointer-events-none absolute left-2 top-2 z-[70] rounded bg-black/75 px-2 py-1.5 font-mono text-[10px] leading-tight text-lime-300 shadow-lg ring-1 ring-lime-400/30"
          style={{ minWidth: "168px" }}
        >
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-lime-400/70">
            Debug: Map Coordinates
          </div>
          <div>
            Cursor:{" "}
            {cursor
              ? `X: ${cursor.x.toFixed(2)}% Y: ${cursor.y.toFixed(2)}%`
              : "— outside map —"}
          </div>
          <div className="mt-0.5 text-amber-300/90">
            Karkonosze: X: {KARKONOSZE_MARKER.left.toFixed(2)}% Y:{" "}
            {KARKONOSZE_MARKER.top.toFixed(2)}%
          </div>
          <div className="mt-0.5 text-cyan-300/90">Zoom: {zoom.toFixed(2)}x</div>
          <div className="mt-0.5 text-fuchsia-300/80">
            Pan: {pan.x.toFixed(0)}, {pan.y.toFixed(0)}
          </div>
          <div className="mt-0.5 text-[9px] text-white/40">
            Click map to drop a marker
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 z-[70] flex flex-col gap-1.5">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={zoomIn}
            disabled={zoomIndex >= ZOOM_STEPS.length - 1}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-white/20 bg-black/70 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/85 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={zoomOut}
            disabled={zoomIndex <= 0}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-white/20 bg-black/70 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/85 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Minus className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

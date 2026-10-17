import type { ClickMark } from "@/lib/useDebugCoordinates";

interface DebugOverlayProps {
  cursor: { x: number; y: number } | null;
  clickMarks: ClickMark[];
  label?: string;
}

export function DebugOverlay({
  cursor,
  clickMarks,
  label = "Image",
}: DebugOverlayProps) {
  return (
    <>
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

      {/* Debug cursor readout */}
      <div
        className="pointer-events-none absolute left-2 top-2 z-[70] rounded bg-black/75 px-2 py-1.5 font-mono text-[10px] leading-tight text-lime-300 shadow-lg ring-1 ring-lime-400/30"
        style={{ minWidth: "168px" }}
      >
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-lime-400/70">
          Debug: {label} Coordinates
        </div>
        <div>
          Cursor:{" "}
          {cursor
            ? `X: ${cursor.x.toFixed(2)}% Y: ${cursor.y.toFixed(2)}%`
            : "— outside area —"}
        </div>
        <div className="mt-0.5 text-[9px] text-white/40">
          Click to drop a marker
        </div>
      </div>
    </>
  );
}

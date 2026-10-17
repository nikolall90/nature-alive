import { useState, type RefObject } from "react";
import { useDebugCoordinates } from "@/lib/useDebugCoordinates";
import { DebugOverlay } from "@/components/DebugOverlay";
import Journal from "@/components/Journal";

const SERENGETI_DISCOVERY_TOTAL = 8;
const SERENGETI_CRYSTAL_TOTAL = 1;
const SERENGETI_IMAGE = "/serengeti-tanzania.jpg";
const LOCATION_NAME = "Serengeti, Tanzania";

interface SerengetiSceneProps {
  onWorldMapSelect: () => void;
}

export default function SerengetiScene({
  onWorldMapSelect,
}: SerengetiSceneProps) {
  const debug = useDebugCoordinates();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showJournal, setShowJournal] = useState(false);

  return (
    <div
      ref={debug.containerRef as RefObject<HTMLDivElement>}
      onMouseMove={debug.handleMouseMove}
      onClick={debug.handleClick}
      onMouseLeave={debug.handleMouseLeave}
      className="relative h-[100dvh] w-screen overflow-hidden bg-[radial-gradient(circle_at_center,#173746_0%,#0b202b_48%,#040d14_100%)]"
    >
      {/* Background photograph */}
      <img
        src={SERENGETI_IMAGE}
        alt="A golden savannah plain in the Serengeti"
        className="absolute inset-0 h-full w-full object-contain select-none"
        draggable={false}
        onLoad={async (event) => {
          const image = event.currentTarget;
          try {
            await image.decode();
          } catch {
            // ignore
          }
          setImageLoaded(true);
        }}
      />

      {imageLoaded && (
        <div className="absolute inset-0">
          {/* Subtle vignette to deepen the edges and focus the eye */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)",
            }}
          />

          {/* Title block */}
          <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex flex-col items-center px-6 pt-[clamp(1.5rem,5vh,3.5rem)] text-center">
            <h1
              className="font-serif text-white/90 tracking-[0.45em] text-[clamp(1.1rem,3.5vw,1.9rem)] uppercase transition-opacity duration-1000"
              style={{ textShadow: "0 2px 18px rgba(0,0,0,0.6)" }}
            >
              Serengeti
            </h1>
            <p
              className="mt-3 font-sans text-white/55 tracking-[0.25em] text-[clamp(0.6rem,1.8vw,0.8rem)] uppercase transition-opacity duration-1000"
              style={{ textShadow: "0 1px 10px rgba(0,0,0,0.6)" }}
            >
              Tanzania
            </p>
          </header>

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
              <span className="whitespace-nowrap">
                Discovered 0/{SERENGETI_DISCOVERY_TOTAL}
              </span>
              <span className="text-[#e8dcc8]/20">|</span>
              <span className="whitespace-nowrap">
                Crystal 0/{SERENGETI_CRYSTAL_TOTAL}
              </span>
              <span className="text-[#e8dcc8]/20">|</span>
              <button
                type="button"
                onClick={() => setShowJournal(true)}
                className="whitespace-nowrap cursor-pointer transition-colors hover:text-[#e8dcc8]/90"
              >
                Journal
              </button>
              <span className="text-[#e8dcc8]/20">|</span>
              <button
                type="button"
                onClick={onWorldMapSelect}
                className="whitespace-nowrap cursor-pointer transition-colors hover:text-[#e8dcc8]/90"
              >
                World Map
              </button>
            </nav>
          </div>

          {showJournal && <Journal onClose={() => setShowJournal(false)} />}
        </div>
      )}

      {import.meta.env.DEV && (
        <DebugOverlay
          cursor={debug.cursor}
          clickMarks={debug.clickMarks}
          label={LOCATION_NAME}
        />
      )}
    </div>
  );
}

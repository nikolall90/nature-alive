import { useEffect, useRef, useState, type CSSProperties } from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 1.25;
const TRANSITION_MS = 520;
const TRANSITION_EASING = "cubic-bezier(0.45, 0.05, 0.25, 1)";

// Wheel deltas must pass this threshold before the zoom steps, so tiny
// accidental movements never trigger a change.
const WHEEL_THRESHOLD = 100;
// After a step, the accumulator keeps this much of its travel direction, so
// reversing the zoom requires deliberate scrolling in the opposite direction
// instead of a stray flick of the wheel.
const DIRECTION_RESIDUE = 80;

interface ZoomState {
  zoom: number;
  focusX: number;
  focusY: number;
}

const INITIAL_ZOOM: ZoomState = { zoom: MIN_ZOOM, focusX: 0, focusY: 0 };

/**
 * Cursor-centered wheel zoom for full-screen scenes. Attach the returned ref
 * to the scene container and apply the returned style to every layer that
 * must scale together (background photo, sprites, masks, hotspots).
 *
 * Two stable states only (normal and close-look): crossing the wheel
 * threshold toggles between them in a single calm transition. The cursor
 * anchor is captured when the gesture starts and is expressed as
 * translate(px * (1 - zoom)) + scale, so the focal point stays pinned for
 * the entire transition and nothing recaptures or wobbles mid-zoom.
 */
export function useSceneZoom() {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<ZoomState>(INITIAL_ZOOM);
  const zoomRef = useRef(MIN_ZOOM);
  const wheelAccum = useRef(0);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;

    const step = (direction: 1 | -1, focusX: number, focusY: number) => {
      const next = direction === 1 ? MAX_ZOOM : MIN_ZOOM;
      if (next === zoomRef.current) {
        wheelAccum.current = 0;
        return;
      }
      zoomRef.current = next;
      wheelAccum.current = -direction * DIRECTION_RESIDUE;
      setState({ zoom: next, focusX, focusY });
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const deltaScale =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? 1000
            : 1;
      wheelAccum.current += event.deltaY * deltaScale;
      // Snap the captured focal point to whole pixels so both stable end
      // states sit on pixel-aligned translations; fractional offsets can then
      // only exist inside the single composited texture, mid-transition.
      const focusX = Math.round(event.clientX - rect.left);
      const focusY = Math.round(event.clientY - rect.top);
      if (wheelAccum.current <= -WHEEL_THRESHOLD) {
        step(1, focusX, focusY);
      } else if (wheelAccum.current >= WHEEL_THRESHOLD) {
        step(-1, focusX, focusY);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const dX = state.focusX * (1 - state.zoom);
  const dY = state.focusY * (1 - state.zoom);

  const zoomStyle: CSSProperties = {
    transform: `translate3d(${dX}px, ${dY}px, 0) scale(${state.zoom})`,
    transformOrigin: "0 0",
    transition: `transform ${TRANSITION_MS}ms ${TRANSITION_EASING}`,
    willChange: "transform",
  };

  return { sceneRef, zoomStyle };
}

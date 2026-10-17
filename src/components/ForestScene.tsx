import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { HOTSPOTS, type Hotspot } from "@/lib/hotspots";
import { playSound, stopAll } from "@/lib/audio";
import { useDebugCoordinates } from "@/lib/useDebugCoordinates";
import { useSceneZoom } from "@/lib/useSceneZoom";
import { DebugOverlay } from "@/components/DebugOverlay";
import Journal from "@/components/Journal";
import TempBlackbirdBehavior from "@/components/TempBlackbirdBehavior";
import ExplorerCursor, {
  useExplorerCursor,
  explorerCursorHide,
} from "@/components/ExplorerCursor";
const FOREST_IMAGE = "/karkonosze-forest.webp";
const LOCATION_NAME = "Karkonosze Forest";
const CRYSTAL_STORAGE_KEY = "forestAliveCrystalCollected";
const DISCOVERED_STORAGE_KEY = "forestAliveDiscovered";

interface ActiveLabel {
  id: string;
  x: number;
  y: number;
}

interface SceneSize {
  width: number;
  height: number;
}

const IMAGE_ASPECT_RATIO = 1.5;
// Extra size over the "cover the viewport" minimum, matching Dolomites.
const OVERSCAN = 1.3;
const BLACKBIRD_VISUAL_POSITION = { x: 35, y: 54 };
const RED_DEER_VISUAL_POSITION = { x: 48, y: 42 };
const RED_DEER_VISUAL_SIZE = { width: 8.0, aspectRatio: 1203 / 1308 };
const BLACKBIRD_INTERACTION_SIZE = { width: 2.0, aspectRatio: 1536 / 1024 };
const WOODPECKER_VISUAL_POSITION = { x: 17.88, y: 18 };
const WOODPECKER_INTERACTION_SIZE = { width: 1.88, aspectRatio: 602 / 1488 };
const FROG_VISUAL_POSITION = { x: 28, y: 80 };
const FROG_INTERACTION_SIZE = { width: 2.85, aspectRatio: 1536 / 1024 };
const SQUIRREL_VISUAL_POSITION = { x: 83.5, y: 54 };
const SQUIRREL_INTERACTION_SIZE = { width: 3.85, aspectRatio: 1318 / 1193 };
const SQUIRREL_POSITION_OFFSET = { x: -8, y: -5 };
const CATERPILLAR_VISUAL_POSITION = { x: 26.03, y: 53.58 };
const PEDICULARIS_VISUAL_POSITION = { x: 42, y: 79 };
// TEMP: animated blackbird test position.
const TEMP_BLACKBIRD_FORAGE_POSITION = { x: 29.41, y: 54.04 };

const ANIMAL_VISUAL_CONFIG: Record<string, {
  visualPosition: { x: number; y: number };
  widthPercent: number;
  aspectRatio: number;
  anchorYFraction: number;
  positionOffset: { x: number; y: number };
}> = {
  blackbird: {
    visualPosition: BLACKBIRD_VISUAL_POSITION,
    widthPercent: BLACKBIRD_INTERACTION_SIZE.width,
    aspectRatio: BLACKBIRD_INTERACTION_SIZE.aspectRatio,
    anchorYFraction: 1.0,
    positionOffset: { x: 0, y: 0 },
  },
  woodpecker: {
    visualPosition: WOODPECKER_VISUAL_POSITION,
    widthPercent: 2.2,
    aspectRatio: 602 / 1488,
    anchorYFraction: 0.5033,
    positionOffset: { x: 0, y: 0 },
  },
  frog: {
    visualPosition: FROG_VISUAL_POSITION,
    widthPercent: FROG_INTERACTION_SIZE.width,
    aspectRatio: FROG_INTERACTION_SIZE.aspectRatio,
    anchorYFraction: 0.5,
    positionOffset: { x: 0, y: 0 },
  },
  squirrel: {
    visualPosition: SQUIRREL_VISUAL_POSITION,
    widthPercent: 5.2,
    aspectRatio: 1318 / 1193,
    anchorYFraction: 1.0,
    positionOffset: SQUIRREL_POSITION_OFFSET,
  },
  deer: {
    visualPosition: RED_DEER_VISUAL_POSITION,
    widthPercent: RED_DEER_VISUAL_SIZE.width,
    aspectRatio: RED_DEER_VISUAL_SIZE.aspectRatio,
    anchorYFraction: 1.0,
    positionOffset: { x: 0, y: 0 },
  },
};

function getImageRect(scene: SceneSize) {
  const sceneAspectRatio = scene.width / scene.height;
  // Smallest size that covers the viewport with no letterboxing, then
  // scaled up so the photo fills the screen at ~130%. The image's own
  // aspect ratio is never touched.
  const coverWidth =
    sceneAspectRatio > IMAGE_ASPECT_RATIO
      ? scene.width
      : scene.height * IMAGE_ASPECT_RATIO;
  const coverHeight = coverWidth / IMAGE_ASPECT_RATIO;
  const width = coverWidth * OVERSCAN;
  const height = coverHeight * OVERSCAN;
  return {
    width,
    height,
    offsetX: (scene.width - width) / 2,
    offsetY: (scene.height - height) / 2,
  };
}

function getImagePosition(x: number, y: number, scene: SceneSize) {
  const { width, height, offsetX, offsetY } = getImageRect(scene);

  return {
    left: ((x / 100 * width + offsetX) / scene.width) * 100,
    top: ((y / 100 * height + offsetY) / scene.height) * 100,
  };
}

interface ForestSceneProps {
  onWorldMapSelect: () => void;
}

export default function ForestScene({ onWorldMapSelect }: ForestSceneProps) {
  return (
    <ExplorerCursor>
      <ForestSceneInner onWorldMapSelect={onWorldMapSelect} />
    </ExplorerCursor>
  );
}

function ForestSceneInner({ onWorldMapSelect }: ForestSceneProps) {
  const cursor = useExplorerCursor();
  const debug = useDebugCoordinates();
  const { sceneRef, zoomStyle } = useSceneZoom();
  const [showJournal, setShowJournal] = useState(false);
  const [forestLoaded, setForestLoaded] = useState(false);
  const [discovered, setDiscovered] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(DISCOVERED_STORAGE_KEY);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch {
      /* ignore */
    }
    return new Set();
  });
  const [sceneSize, setSceneSize] = useState<SceneSize>({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const imageRect = getImageRect(sceneSize);
  // Sprites and hotspot sizes were tuned for the old letterboxed image
  // width; scale them by the same factor so animals keep their size
  // relative to the photograph.
  const legacyContainWidth =
    sceneSize.width / sceneSize.height > IMAGE_ASPECT_RATIO
      ? sceneSize.height * IMAGE_ASPECT_RATIO
      : sceneSize.width;
  const spriteScale = imageRect.width / legacyContainWidth;
  const scaled = (value: string) => `calc(${value} * ${spriteScale.toFixed(4)})`;
  const imageRectStyle: CSSProperties = {
    position: "absolute",
    left: imageRect.offsetX,
    top: imageRect.offsetY,
    width: imageRect.width,
    height: imageRect.height,
  };
  const [activeLabel, setActiveLabel] = useState<ActiveLabel | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [crystalCollected, setCrystalCollected] = useState(() => {
    try {
      return localStorage.getItem(CRYSTAL_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [crystalFading, setCrystalFading] = useState(false);
  const labelTimer = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setSceneSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      stopAll();
      if (labelTimer.current) window.clearTimeout(labelTimer.current);
    };
  }, []);

  const handleHotspot = useCallback(
    (hotspot: Hotspot) => {
      playSound(hotspot.id);
      setDiscovered((prev) => {
        const next = new Set(prev);
        next.add(hotspot.id);
        try {
          localStorage.setItem(
            DISCOVERED_STORAGE_KEY,
            JSON.stringify([...next]),
          );
        } catch {
          /* ignore */
        }
        return next;
      });

      const config = ANIMAL_VISUAL_CONFIG[hotspot.id];
      const visualPos = config
        ? config.visualPosition
        : { x: hotspot.x, y: hotspot.y };
      const positionOffset = config ? config.positionOffset : { x: 0, y: 0 };
      const pos = getImagePosition(visualPos.x, visualPos.y, sceneSize);
      const animalX = (pos.left / 100) * sceneSize.width + positionOffset.x;
      const anchorY = (pos.top / 100) * sceneSize.height + positionOffset.y;

      let imageTopY = anchorY;
      if (config) {
        const imageWidthPx =
          ((config.widthPercent / 100) * sceneSize.width) * spriteScale;
        const imageHeightPx = imageWidthPx / config.aspectRatio;
        imageTopY = anchorY - config.anchorYFraction * imageHeightPx;
      }

      const LABEL_OFFSET = 55;
      let labelY = imageTopY - LABEL_OFFSET;
      if (labelY < 70) {
        labelY = anchorY + LABEL_OFFSET;
      }

      if (labelTimer.current) window.clearTimeout(labelTimer.current);
      setActiveLabel({ id: hotspot.id, x: animalX, y: labelY });

      labelTimer.current = window.setTimeout(() => {
        setActiveLabel(null);
      }, 2800);
    },
    [sceneSize],
  );

  const allFound = discovered.size === HOTSPOTS.length;

  return (
    <div
      ref={(node) => {
        (
          debug.containerRef as { current: HTMLDivElement | null }
        ).current = node;
        sceneRef.current = node;
      }}
      onMouseMove={debug.handleMouseMove}
      onClick={debug.handleClick}
      onMouseLeave={debug.handleMouseLeave}
      className="relative h-[100dvh] w-screen overflow-hidden bg-[radial-gradient(circle_at_center,#173746_0%,#0b202b_48%,#040d14_100%)]"
      style={explorerCursorHide}
    >
      {/* Zoom layer — the background photo and every layer aligned with it
          (animals, foreground masks, crystal, hotspot buttons) scale together
          around the cursor. Titles, labels, nav and Journal stay outside. */}
      <div className="absolute inset-0 overflow-hidden" style={zoomStyle}>
      {/* Background photograph */}
      <img
        src={FOREST_IMAGE}
        alt="A misty forest path with sunlight filtering through the trees"
       className="absolute select-none"
        style={imageRectStyle}
        draggable={false}
         onLoad={async (event) => {
  const image = event.currentTarget;
  try {
    await image.decode();
  } catch {
    // ignore
  }
  setForestLoaded(true);
}}
      />

      {forestLoaded && (
        <div className="absolute inset-0">

      {/* Animal layer — transparent wildlife sprites sit above the background,
          below the foreground mask and hotspots. */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>




        
        <img
          src="/red-deer-cervus-elaphus.png"
          alt=""
          draggable={false}
          className="absolute select-none"
          style={{
            left: `${getImagePosition(RED_DEER_VISUAL_POSITION.x, RED_DEER_VISUAL_POSITION.y, sceneSize).left}%`,
            top: `${getImagePosition(RED_DEER_VISUAL_POSITION.x, RED_DEER_VISUAL_POSITION.y, sceneSize).top}%`,
   width: scaled("min(6.7vw, 10.05dvh)"),
            height: "auto",
            objectFit: "contain",
            transform: "translate(-50%, -100%)",
          }}
        />
        {HOTSPOTS.filter((hotspot) => hotspot.id === "blackbird").map(() => {
          const position = getImagePosition(
            BLACKBIRD_VISUAL_POSITION.x,
            BLACKBIRD_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <img
              key="blackbird-visual"
              src="/blackbird-turdus-merula.png"
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
            width: scaled("min(3vw, 4.5dvh)"),
                height: "auto",
                objectFit: "contain",
                transform: "translate(-50%, -100%)",
              }}
            />
          );
        })}

        {/* TEMP: animated blackbird behavior test. */}

        {HOTSPOTS.filter((hotspot) => hotspot.id === "woodpecker").map(() => {
          const position = getImagePosition(
            WOODPECKER_VISUAL_POSITION.x,
            WOODPECKER_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <img
              key="woodpecker-visual"
              src="/great-spotted-woodpecker.png"
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: scaled("min(2vw, 3dvh)"),
                height: "auto",
                objectFit: "contain",
                transform: "translate(-53.91%, -50.33%)",
              }}
            />
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "frog").map(() => {
          const position = getImagePosition(
            FROG_VISUAL_POSITION.x,
            FROG_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <img
              key="frog-visual"
              src="/common-frog-rana-temporaria.png"
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: scaled("min(4.2vw, 6.3dvh)"),
                height: "auto",
                objectFit: "contain",
                filter: "hue-rotate(35deg) saturate(0.65)",
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "squirrel").map(() => {
          const position = getImagePosition(
            SQUIRREL_VISUAL_POSITION.x,
            SQUIRREL_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <img
              key="squirrel-visual"
              src="/european-red-squirrel-sciurus-vulgaris.png"
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                left: `calc(${position.left}% + ${SQUIRREL_POSITION_OFFSET.x}px)`,
                top: `calc(${position.top}% + ${SQUIRREL_POSITION_OFFSET.y}px)`,
               width: scaled("min(4.1vw, 6.15dvh)"),
                height: "auto",
                objectFit: "contain",
                transform: "translate(-50%, -100%)",
              }}
            />
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "caterpillar").map(() => {
          const position = getImagePosition(
            CATERPILLAR_VISUAL_POSITION.x,
            CATERPILLAR_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <img
              key="caterpillar-visual"
              src="/karkonosze-psodos-quadrifaria-sudetica-caterpillar.png"
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: scaled("30px"),
                height: "auto",
                objectFit: "contain",
                transform: "translate(-50%, -50%)",
                opacity: 0.88,
              }}
            />
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "lousewort").map(() => {
          const position = getImagePosition(
            PEDICULARIS_VISUAL_POSITION.x,
            PEDICULARIS_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <img
              key="lousewort-visual"
              src="/karkonosze-pedicularis-sudetica.png"
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: scaled("2.5%"),
                height: "auto",
                objectFit: "contain",
                transform: "translate(-50%, -50%)",
                opacity: 0.88,
              }}
            />
          );
        })}
      </div>


{/* TEMP: animated blackbird test — rendered above foreground mask. */}
<div
  className="pointer-events-none absolute inset-0"
  style={{ zIndex: 11 }}
>
  {(() => {
    const pos = getImagePosition(
      TEMP_BLACKBIRD_FORAGE_POSITION.x,
      TEMP_BLACKBIRD_FORAGE_POSITION.y,
      sceneSize,
    );
    return (
      <div
        className="absolute"
        style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: 0, height: 0 }}
      >
        <div
          style={{
            transform: `scale(${spriteScale})`,
            transformOrigin: "0 0",
          }}
        >
          <TempBlackbirdBehavior left="0%" top="0%" />
        </div>
      </div>
    );
  })()}
</div>


          
      {/* Foreground mask — a masked copy of the background photograph.
          Foreground elements (trees, grass, rocks) will be shown here so
          animal sprites can appear partially occluded by them.
          Unchanged source image; only the mask reveals selective regions. */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 8 }}>
        {(() => {
          const pts = [
            { x: 43.6, y: 38.6 },
            { x: 44.3, y: 37.9 },
            { x: 44.9, y: 38.4 },
            { x: 45.5, y: 37.6 },
            { x: 46.1, y: 38.2 },
            { x: 46.8, y: 37.3 },
            { x: 47.5, y: 36.4 },
            { x: 48.2, y: 35.9 },
            { x: 48.9, y: 36.3 },
            { x: 49.6, y: 35.7 },
            { x: 50.3, y: 36.2 },
            { x: 51.0, y: 35.6 },
            { x: 51.7, y: 36.3 },
            { x: 52.4, y: 35.8 },
            { x: 53.1, y: 36.6 },
            { x: 53.9, y: 36.1 },
            { x: 54.7, y: 37.0 },
            { x: 54.7, y: 47 },
            { x: 43.6, y: 47 },
          ];
          // The masked photo copies fill the oversized image rect, so clip
          // points use raw image percentages directly.
          const clip = `polygon(${pts.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
          return (
            <img
              src={FOREST_IMAGE}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{ ...imageRectStyle, clipPath: clip }}
            />
          );
        })()}
        {(() => {
          const pts = [
            { x: 43.9, y: 38.8 },
            { x: 44.3, y: 37.6 },
            { x: 45.2, y: 37.1 },
            { x: 46.1, y: 37.5 },
            { x: 46.6, y: 38.4 },
            { x: 46.9, y: 39.6 },
            { x: 46.5, y: 40.8 },
            { x: 45.6, y: 41.5 },
            { x: 44.6, y: 41.3 },
            { x: 43.9, y: 40.2 },
          ];
          // The masked photo copies fill the oversized image rect, so clip
          // points use raw image percentages directly.
          const clip = `polygon(${pts.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
          return (
            <img
              src={FOREST_IMAGE}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{ ...imageRectStyle, clipPath: clip }}
            />
          );
        })()}
        {(() => {
          const pts = [
            { x: 51.2, y: 38.4 },
            { x: 52.0, y: 37.9 },
            { x: 52.9, y: 38.2 },
            { x: 53.7, y: 37.8 },
            { x: 54.4, y: 38.3 },
            { x: 54.6, y: 39.4 },
            { x: 54.2, y: 40.6 },
            { x: 53.2, y: 41.3 },
            { x: 52.2, y: 41.0 },
            { x: 51.4, y: 40.2 },
            { x: 51.0, y: 39.2 },
          ];
          // The masked photo copies fill the oversized image rect, so clip
          // points use raw image percentages directly.
          const clip = `polygon(${pts.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
          return (
            <img
              src={FOREST_IMAGE}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{ ...imageRectStyle, clipPath: clip }}
            />
          );
        })()}
        {(() => {
          const pts = [
            { x: 49.4, y: 37.4 },
            { x: 50.3, y: 36.6 },
            { x: 51.3, y: 36.9 },
            { x: 52.2, y: 36.5 },
            { x: 53.0, y: 37.0 },
            { x: 53.3, y: 38.0 },
            { x: 52.8, y: 39.0 },
            { x: 51.8, y: 39.5 },
            { x: 50.7, y: 39.2 },
            { x: 49.8, y: 38.5 },
          ];
          // The masked photo copies fill the oversized image rect, so clip
          // points use raw image percentages directly.
          const clip = `polygon(${pts.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
          return (
            <img
              src={FOREST_IMAGE}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{ ...imageRectStyle, clipPath: clip }}
            />
          );
        })()}
        {(() => {
          const pts = [
            { x: 46.6, y: 38.0 },
            { x: 47.5, y: 37.2 },
            { x: 48.5, y: 37.5 },
            { x: 49.2, y: 38.1 },
            { x: 49.0, y: 39.0 },
            { x: 48.1, y: 39.6 },
            { x: 47.1, y: 39.3 },
            { x: 46.5, y: 38.7 },
          ];
          // The masked photo copies fill the oversized image rect, so clip
          // points use raw image percentages directly.
          const clip = `polygon(${pts.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
          return (
            <img
              src={FOREST_IMAGE}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{ ...imageRectStyle, clipPath: clip }}
            />
          );
        })()}
        {(() => {
          const pts = [
            { x: 19.4, y: 13 },
            { x: 19.7, y: 13.8 },
            { x: 20.3, y: 14.8 },
            { x: 21, y: 16 },
            { x: 21.6, y: 17.5 },
            { x: 21.8, y: 19 },
            { x: 21.5, y: 20.5 },
            { x: 21.9, y: 22 },
            { x: 21.3, y: 23.2 },
            { x: 20.6, y: 24.2 },
            { x: 19.8, y: 25 },
            { x: 19.2, y: 24 },
            { x: 19.5, y: 22.5 },
            { x: 19, y: 21 },
            { x: 19.3, y: 19.5 },
            { x: 18.8, y: 18 },
            { x: 19.1, y: 16.2 },
            { x: 18.9, y: 14.5 },
          ];
          // The masked photo copies fill the oversized image rect, so clip
          // points use raw image percentages directly.
          const clip = `polygon(${pts.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
          return (
            <img
              src={FOREST_IMAGE}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                ...imageRectStyle,
                clipPath: clip,
                filter: "drop-shadow(0 0 1.5px rgba(255,255,255,0.7))",
              }}
            />
          );
        })()}
        {(() => {
          const pts = [
            { x: 80.5, y: 53.1 },
            { x: 81.3, y: 52.5 },
            { x: 82.2, y: 53.1 },
            { x: 83, y: 52.6 },
            { x: 83.8, y: 53.2 },
            { x: 84.7, y: 52.7 },
            { x: 85.8, y: 53.3 },
            { x: 87.4, y: 53.1 },
            { x: 88.5, y: 55.8 },
            { x: 80.5, y: 55.8 },
          ];
          // The masked photo copies fill the oversized image rect, so clip
          // points use raw image percentages directly.
          const clip = `polygon(${pts.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
          return (
            <img
              src={FOREST_IMAGE}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{ ...imageRectStyle, clipPath: clip }}
            />
          );
        })()}

      </div>

      {/* Dedicated right-side stump foreground — a clipped copy of the
          background photograph rendered above the squirrel so the stump
          visibly occludes the squirrel's lower body. Pixel-perfect aligned
          with the background via object-cover and getImagePosition. */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 9 }}>
        {(() => {
          const pts = [
            { x: 80.15, y: 52.4 },
            { x: 80.5, y: 51.7 },
            { x: 80.8, y: 52.1 },
            { x: 81.1, y: 51.6 },
            { x: 81.4, y: 52.0 },
            { x: 81.8, y: 51.5 },
            { x: 82.1, y: 52.2 },
            { x: 82.5, y: 51.7 },
            { x: 82.9, y: 52.3 },
            { x: 83.3, y: 51.8 },
            { x: 83.7, y: 52.4 },
            { x: 84.1, y: 51.9 },
            { x: 84.5, y: 52.5 },
            { x: 84.9, y: 52.0 },
            { x: 85.3, y: 52.6 },
            { x: 85.8, y: 52.1 },
            { x: 86.3, y: 52.7 },
            { x: 86.8, y: 52.2 },
            { x: 87.3, y: 52.8 },
            { x: 87.8, y: 52.3 },
            { x: 88.3, y: 52.9 },
            { x: 88.8, y: 53.4 },
            { x: 89.2, y: 58.0 },
            { x: 80.15, y: 58.0 },
          ];
          // The masked photo copies fill the oversized image rect, so clip
          // points use raw image percentages directly.
          const clip = `polygon(${pts.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
          return (
            <img
              src={FOREST_IMAGE}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{ ...imageRectStyle, clipPath: clip }}
            />
          );
        })()}
      </div>

      {/* Foreground grass blades from the same photograph — thin irregular
          clips of real vegetation pixels rendered above the squirrel so
          a few natural grass blades overlap its lowest body. No filters,
          no opacity, no generated imagery — only clipped photograph pixels. */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 10 }}>
        {[
          [
            { x: 80.9, y: 56.2 }, { x: 81.2, y: 56.2 },
            { x: 81.25, y: 51.2 }, { x: 81.0, y: 51.6 },
          ],
          [
            { x: 81.6, y: 56.4 }, { x: 81.85, y: 56.4 },
            { x: 81.9, y: 50.6 }, { x: 81.7, y: 51.2 },
          ],
          [
            { x: 82.3, y: 56.3 }, { x: 82.55, y: 56.3 },
            { x: 82.6, y: 51.0 }, { x: 82.4, y: 51.4 },
          ],
          [
            { x: 83.0, y: 56.5 }, { x: 83.2, y: 56.5 },
            { x: 83.25, y: 51.4 }, { x: 83.05, y: 51.7 },
          ],
          [
            { x: 83.7, y: 56.4 }, { x: 83.95, y: 56.4 },
            { x: 84.0, y: 50.8 }, { x: 83.8, y: 51.3 },
          ],
          [
            { x: 84.4, y: 56.6 }, { x: 84.6, y: 56.6 },
            { x: 84.65, y: 51.2 }, { x: 84.5, y: 51.6 },
          ],
          [
            { x: 85.1, y: 56.5 }, { x: 85.35, y: 56.5 },
            { x: 85.4, y: 51.0 }, { x: 85.2, y: 51.4 },
          ],
          [
            { x: 85.8, y: 56.7 }, { x: 86.0, y: 56.7 },
            { x: 86.05, y: 51.5 }, { x: 85.9, y: 51.8 },
          ],
          [
            { x: 86.5, y: 56.4 }, { x: 86.75, y: 56.4 },
            { x: 86.8, y: 51.1 }, { x: 86.6, y: 51.5 },
          ],
          [
            { x: 87.2, y: 56.6 }, { x: 87.4, y: 56.6 },
            { x: 87.45, y: 51.3 }, { x: 87.3, y: 51.7 },
          ],
          [
            { x: 87.9, y: 56.5 }, { x: 88.1, y: 56.5 },
            { x: 88.15, y: 51.6 }, { x: 88.0, y: 51.9 },
          ],
          [
            { x: 40.8, y: 82 }, { x: 41.3, y: 82 },
            { x: 41.4, y: 78 }, { x: 41.0, y: 78.5 },
          ],
          [
            { x: 41.6, y: 82.2 }, { x: 42.1, y: 82.2 },
            { x: 42.2, y: 77.5 }, { x: 41.8, y: 78 },
          ],
          [
            { x: 42.4, y: 82.1 }, { x: 42.9, y: 82.1 },
            { x: 43.0, y: 77.8 }, { x: 42.6, y: 78.3 },
          ],
          [
            { x: 43.2, y: 82.3 }, { x: 43.7, y: 82.3 },
            { x: 43.8, y: 78.2 }, { x: 43.4, y: 78.6 },
          ],
        ].map((blade, index) => {
          const clip = `polygon(${blade.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
          return (
            <img
              key={`foreground-grass-${index}`}
              src={FOREST_IMAGE}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{ ...imageRectStyle, clipPath: clip }}
            />
          );
        })}
      </div>

      {/* New foreground grass blades — standalone vector elements (not
          photograph pixels) with a very slow, barely noticeable sway. */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 10 }}>
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            left: `${getImagePosition(24.5, 88, sceneSize).left}%`,
            top: `${getImagePosition(24.5, 88, sceneSize).top}%`,
            width: scaled("clamp(30px, 2.6vw, 46px)"),
            height: "auto",
            transform: "translate(-50%, -100%)",
          }}
        >
          <svg
            viewBox="0 0 24 64"
            fill="none"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              opacity: 0.55,
              animation: "grassSwayA 16s ease-in-out infinite",
              transformOrigin: "50% 100%",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
            }}
          >
            <path
              d="M12 64C10 52 9 40 7.5 30 6 20 6 12 6.5 4c1 6 3 14 5.5 22"
              fill="#3e4a2c"
              opacity="0.9"
            />
            <path
              d="M12 64c2-12 3-24 4.5-34C18 20 18 12 17.5 4c-1 6-3 14-5.5 22"
              fill="#37421f"
              opacity="0.9"
            />
          </svg>
        </div>
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            left: `${getImagePosition(74.5, 90, sceneSize).left}%`,
            top: `${getImagePosition(74.5, 90, sceneSize).top}%`,
            width: scaled("clamp(24px, 2.1vw, 38px)"),
            height: "auto",
            transform: "translate(-50%, -100%)",
          }}
        >
          <svg
            viewBox="0 0 24 58"
            fill="none"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              opacity: 0.5,
              animation: "grassSwayB 19s ease-in-out infinite",
              transformOrigin: "50% 100%",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
            }}
          >
            <path
              d="M12 58c-2-10-3-21-4.5-30C6 18 6 10 6.5 3c1 5 3 13 5.5 20"
              fill="#39422a"
              opacity="0.9"
            />
            <path
              d="M12 58c2-10 3-21 4.5-30C18 18 18 10 17.5 3c-1 5-3 13-5.5 20"
              fill="#333d24"
              opacity="0.9"
            />
          </svg>
        </div>
      </div>

      {/* Quartz crystal — a small natural specimen resting in the grass
          beside the large foreground rock. Partially hidden in the
          vegetation. Click to collect. */}
      {!crystalCollected && (
        <button
          type="button"
          aria-label="A quartz crystal"
          onMouseEnter={() => cursor?.setDiscover(true)}
          onMouseLeave={() => cursor?.setDiscover(false)}
          onClick={() => {
            setCrystalFading(true);
            window.setTimeout(() => {
              setCrystalCollected(true);
              try {
                localStorage.setItem(CRYSTAL_STORAGE_KEY, "true");
              } catch {
                /* ignore */
              }
            }, 400);
          }}
          className="absolute cursor-pointer border-none bg-transparent p-0 outline-none"
          style={{
            left: `calc(${getImagePosition(66, 72, sceneSize).left}% + ${(100 * spriteScale).toFixed(1)}px)`,
            top: `calc(${getImagePosition(66, 72, sceneSize).top}% + ${(50 * spriteScale).toFixed(1)}px)`,
            transform: "translate(-50%, -85%) rotate(-8deg)",
            zIndex: 49,
          }}
        >
          <img
            src="/karkonosze-quartz-crystal.png"
            alt=""
            draggable={false}
            style={{
              display: "block",
              width: scaled("3.6vw"),
              height: "auto",
              filter: "drop-shadow(2px 3px 3px rgba(0,0,0,0.5)) brightness(0.92) contrast(0.95)",
              opacity: crystalFading ? 0 : 0.88,
              mixBlendMode: "multiply",
              transition: "opacity 400ms ease-out",
            }}
          />
        </button>
      )}

      {/* Subtle vignette to deepen the edges and focus the eye */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      {/* Hotspot layer */}
      <div className="absolute inset-0 z-10">
        {HOTSPOTS.filter((hotspot) => hotspot.id !== "blackbird" && hotspot.id !== "woodpecker" && hotspot.id !== "frog" && hotspot.id !== "squirrel" && hotspot.id !== "deer" && hotspot.id !== "caterpillar" && hotspot.id !== "lousewort").map((hotspot) => {
          const isHovered = hoveredId === hotspot.id;
          const isDiscovered = discovered.has(hotspot.id);
          const position = getImagePosition(hotspot.x, hotspot.y, sceneSize);
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-label={hotspot.label}
              onMouseEnter={() => {
              cursor?.setDiscover(true);
              setHoveredId(hotspot.id);
            }}
              onMouseLeave={() => {
              cursor?.setDiscover(false);
              setHoveredId(null);
            }}
              onClick={() => handleHotspot(hotspot)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none transition-[transform] duration-500 ease-out"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: scaled(`${hotspot.radius * 2}%`),
                aspectRatio: "1 / 1",
                background: "transparent",
                border: "none",
                transform: isHovered ? "translate(-50%, -50%) scale(1.08)" : undefined,
              }}
            >
              {/* Very subtle hover wash — the only visual hint */}
              <span
                className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-700"
                style={{
                  opacity: isHovered ? 1 : 0,
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 70%)",
                }}
              />
              {/* Faint discovered shimmer so found spots feel resolved */}
              <span
                className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-1000"
                style={{
                  opacity: isDiscovered ? 0.5 : 0,
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 65%)",
                }}
              />
            </button>
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "deer").map((hotspot) => {
          const position = getImagePosition(
            RED_DEER_VISUAL_POSITION.x,
            RED_DEER_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-label={hotspot.label}
              onMouseEnter={() => {
              cursor?.setDiscover(true);
              setHoveredId(hotspot.id);
            }}
              onMouseLeave={() => {
              cursor?.setDiscover(false);
              setHoveredId(null);
            }}
              onClick={() => handleHotspot(hotspot)}
              className="group absolute cursor-pointer rounded-full outline-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
               width: scaled("min(6.7vw, 10.05dvh)"),
                aspectRatio: `${RED_DEER_VISUAL_SIZE.aspectRatio}`,
                background: "transparent",
                border: "none",
                clipPath: "polygon(0% 0%, 84% 0%, 96% 13%, 90% 25%, 83% 45%, 80% 62%, 72% 78%, 58% 82%, 44% 80%, 36% 65%, 27% 48%, 8% 25%, 0% 12%)",
                transform: "translate(-50%, -100%)",
              }}
            />
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "blackbird").map((hotspot) => {
          const position = getImagePosition(
            BLACKBIRD_VISUAL_POSITION.x,
            BLACKBIRD_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-label={hotspot.label}
              onMouseEnter={() => {
              cursor?.setDiscover(true);
              setHoveredId(hotspot.id);
            }}
              onMouseLeave={() => {
              cursor?.setDiscover(false);
              setHoveredId(null);
            }}
              onClick={() => handleHotspot(hotspot)}
              className="group absolute cursor-pointer rounded-full outline-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: scaled("min(3vw, 4.5dvh)"),
                aspectRatio: `${BLACKBIRD_INTERACTION_SIZE.aspectRatio}`,
                background: "transparent",
                border: "none",
                transform: "translate(-50%, -100%)",
              }}
            />
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "squirrel").map((hotspot) => {
          const position = getImagePosition(
            SQUIRREL_VISUAL_POSITION.x,
            SQUIRREL_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-label={hotspot.label}
              onMouseEnter={() => {
              cursor?.setDiscover(true);
              setHoveredId(hotspot.id);
            }}
              onMouseLeave={() => {
              cursor?.setDiscover(false);
              setHoveredId(null);
            }}
              onClick={() => handleHotspot(hotspot)}
              className="group absolute cursor-pointer rounded-full outline-none"
              style={{
                left: `calc(${position.left}% + ${SQUIRREL_POSITION_OFFSET.x}px)`,
                top: `calc(${position.top}% + ${SQUIRREL_POSITION_OFFSET.y}px)`,
                width: scaled(`${SQUIRREL_INTERACTION_SIZE.width}%`),
                aspectRatio: `${SQUIRREL_INTERACTION_SIZE.aspectRatio}`,
                background: "transparent",
                border: "none",
                transform: "translate(-50%, -100%)",
              }}
            />
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "frog").map((hotspot) => {
          const position = getImagePosition(
            FROG_VISUAL_POSITION.x,
            FROG_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-label={hotspot.label}
              onMouseEnter={() => {
              cursor?.setDiscover(true);
              setHoveredId(hotspot.id);
            }}
              onMouseLeave={() => {
              cursor?.setDiscover(false);
              setHoveredId(null);
            }}
              onClick={() => handleHotspot(hotspot)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: scaled(`${FROG_INTERACTION_SIZE.width}%`),
                aspectRatio: `${FROG_INTERACTION_SIZE.aspectRatio}`,
                background: "transparent",
                border: "none",
              }}
            >
              <span
                className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-1000"
                style={{
                  opacity: discovered.has(hotspot.id) ? 0.5 : 0,
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 65%)",
                }}
              />
            </button>
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "woodpecker").map((hotspot) => {
          const isHovered = hoveredId === hotspot.id;
          const position = getImagePosition(
            WOODPECKER_VISUAL_POSITION.x,
            WOODPECKER_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-label={hotspot.label}
              onMouseEnter={() => {
              cursor?.setDiscover(true);
              setHoveredId(hotspot.id);
            }}
              onMouseLeave={() => {
              cursor?.setDiscover(false);
              setHoveredId(null);
            }}
              onClick={() => handleHotspot(hotspot)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: scaled(`${WOODPECKER_INTERACTION_SIZE.width}%`),
                aspectRatio: `${WOODPECKER_INTERACTION_SIZE.aspectRatio}`,
                background: "transparent",
                border: "none",
              }}
            >
              <span
                className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-700"
                style={{
                  opacity: isHovered ? 1 : 0,
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 70%)",
                }}
              />
              <span
                className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-1000"
                style={{
                  opacity: discovered.has(hotspot.id) ? 0.5 : 0,
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 65%)",
                }}
              />
            </button>
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "caterpillar").map((hotspot) => {
          const position = getImagePosition(
            CATERPILLAR_VISUAL_POSITION.x,
            CATERPILLAR_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-label={hotspot.label}
              onMouseEnter={() => cursor?.setDiscover(true)}
              onMouseLeave={() => cursor?.setDiscover(false)}
              onClick={() => handleHotspot(hotspot)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: scaled("38px"),
                height: scaled("38px"),
                background: "transparent",
                border: "none",
              }}
            />
          );
        })}
        {HOTSPOTS.filter((hotspot) => hotspot.id === "lousewort").map((hotspot) => {
          const position = getImagePosition(
            PEDICULARIS_VISUAL_POSITION.x,
            PEDICULARIS_VISUAL_POSITION.y,
            sceneSize,
          );
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-label={hotspot.label}
              onMouseEnter={() => cursor?.setDiscover(true)}
              onMouseLeave={() => cursor?.setDiscover(false)}
              onClick={() => handleHotspot(hotspot)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: scaled("38px"),
                height: scaled("38px"),
                background: "transparent",
                border: "none",
              }}
            />
          );
        })}
      </div>
        </div>
      )}
      </div>

      {forestLoaded && (
        <>
      {/* Title block */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex flex-col items-center px-6 pt-[clamp(1.5rem,5vh,3.5rem)] text-center">
  <h1
    className="font-serif text-white/90 tracking-[0.45em] text-[clamp(1.1rem,3.5vw,1.9rem)] uppercase transition-opacity duration-1000"
    style={{ textShadow: "0 2px 18px rgba(0,0,0,0.6)" }}
  >
    Karkonosze Mountains
  </h1>
  <p
    className="mt-3 font-sans text-white/55 tracking-[0.25em] text-[clamp(0.6rem,1.8vw,0.8rem)] uppercase transition-opacity duration-1000"
    style={{ textShadow: "0 1px 10px rgba(0,0,0,0.6)" }}
  >
    Poland
  </p>
</header>

      {/* Floating name label near the click point */}
      {activeLabel && (
        <div
          className="pointer-events-none fixed z-30 -translate-x-1/2 -translate-y-1/2"
          style={{ left: activeLabel.x, top: activeLabel.y }}
        >
          <div className="animate-fade-up">
            <span
              className="inline-block whitespace-nowrap font-sans text-white/90 text-[clamp(0.56rem,1.6vw,0.76rem)] tracking-[0.35em] uppercase"
              style={{
                textShadow: "0 2px 14px rgba(0,0,0,0.85)",
                background: "rgba(0,0,0,0.25)",
                padding: "0.45rem 1rem",
                borderRadius: "9999px",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
            >
              {HOTSPOTS.find((h) => h.id === activeLabel.id)?.label}
            </span>
          </div>
        </div>
      )}

      {/* Bottom navigation / status bar */}
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
            Discovered {discovered.size}/{HOTSPOTS.length}
          </span>
          <span className="text-[#e8dcc8]/20">|</span>
          <span className="whitespace-nowrap">
            Crystal {crystalCollected ? 1 : 0}/1
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
        </>
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

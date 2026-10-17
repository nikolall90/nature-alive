import { useEffect, useRef } from "react";
import parseAPNG from "apng-js";

type Behavior = "forage" | "look";

const BEHAVIOR_SRC: Record<Behavior, string> = {
  forage: "/blackbird_forage.apng",
  look: "/blackbird_look.apng",
};

/*
 * Behavior tuning
 *
 * The bird mainly forages.
 * "look" is a rarer interruption that makes the behavior
 * feel less like a repeating animation loop.
 */

const MIN_FORAGE_STREAK = 2;
const MAX_FORAGE_STREAK = 3;

const LOOK_CHANCE_AFTER_TWO_FORAGES = 0.35;

/*
 * Pause ranges.
 *
 * Most pauses are short, but occasionally we create
 * a noticeably longer quiet moment.
 */
const SHORT_PAUSE_MIN_MS = 700;
const SHORT_PAUSE_MAX_MS = 1800;

const MEDIUM_PAUSE_MIN_MS = 1800;
const MEDIUM_PAUSE_MAX_MS = 3200;

const LONG_PAUSE_MIN_MS = 4000;
const LONG_PAUSE_MAX_MS = 7000;

const MEDIUM_PAUSE_CHANCE = 0.18;
const LONG_PAUSE_CHANCE = 0.08;

interface ApngPlayer {
  play(): void;
  stop(): void;
  on(event: "end", listener: () => void): void;
}

interface ApngAnimation {
  width: number;
  height: number;
  numPlays: number;
  getPlayer(
    context: CanvasRenderingContext2D,
    autoPlay?: boolean,
  ): Promise<ApngPlayer>;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/*
 * Decide what happens after a forage animation.
 *
 * We deliberately avoid making every cycle identical:
 *
 * 1 forage  -> always another forage
 * 2 forages -> usually another forage, sometimes look
 * 3 forages -> look
 */
function pickAfterForage(streak: number): Behavior {
  if (streak < MIN_FORAGE_STREAK) {
    return "forage";
  }

  if (streak >= MAX_FORAGE_STREAK) {
    return "look";
  }

  return Math.random() < LOOK_CHANCE_AFTER_TWO_FORAGES
    ? "look"
    : "forage";
}

function pickPause(behavior: Behavior): number {
  /*
   * Look deserves a little more breathing room afterwards.
   */
  if (behavior === "look") {
    return randomBetween(
      MEDIUM_PAUSE_MIN_MS,
      MEDIUM_PAUSE_MAX_MS,
    );
  }

  const roll = Math.random();

  /*
   * Rare long quiet moment.
   */
  if (roll < LONG_PAUSE_CHANCE) {
    return randomBetween(
      LONG_PAUSE_MIN_MS,
      LONG_PAUSE_MAX_MS,
    );
  }

  /*
   * Occasional medium pause.
   */
  if (roll < LONG_PAUSE_CHANCE + MEDIUM_PAUSE_CHANCE) {
    return randomBetween(
      MEDIUM_PAUSE_MIN_MS,
      MEDIUM_PAUSE_MAX_MS,
    );
  }

  /*
   * Normal short pause.
   */
  return randomBetween(
    SHORT_PAUSE_MIN_MS,
    SHORT_PAUSE_MAX_MS,
  );
}

interface TempBlackbirdBehaviorProps {
  left: string;
  top: string;
}

export default function TempBlackbirdBehavior({
  left,
  top,
}: TempBlackbirdBehaviorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const playersRef = useRef<
    Partial<Record<Behavior, ApngPlayer>>
  >({});

  useEffect(() => {
    let cancelled = false;
    let pauseTimer: number | null = null;

    let current: Behavior = "forage";
    let forageStreak = 1;

    const loadBehavior = async (
      behavior: Behavior,
      context: CanvasRenderingContext2D,
    ): Promise<ApngPlayer | null> => {
      try {
        const response = await fetch(
          BEHAVIOR_SRC[behavior],
          { cache: "force-cache" },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to load ${BEHAVIOR_SRC[behavior]}: ${response.status}`,
          );
        }

        const buffer = await response.arrayBuffer();

        if (cancelled) return null;

        const parsed = parseAPNG(buffer);

        if (parsed instanceof Error) {
          throw parsed;
        }

        const apng = parsed as ApngAnimation;

        /*
         * Each behavior plays exactly once.
         */
        apng.numPlays = 1;

        const player = await apng.getPlayer(
          context,
          false,
        );

        if (cancelled) {
          player.stop();
          return null;
        }

        return player;
      } catch (error) {
        console.error(
          `Blackbird ${behavior} APNG error:`,
          error,
        );

        return null;
      }
    };

    const startBehavior = (behavior: Behavior) => {
      if (cancelled) return;

      const player = playersRef.current[behavior];

      if (!player) return;

      current = behavior;

      /*
       * Reset to the first frame before every play.
       */
      player.stop();
      player.play();
    };

    const scheduleNextBehavior = () => {
      if (cancelled) return;

      let next: Behavior;

      if (current === "look") {
        /*
         * Look always returns to foraging.
         */
        next = "forage";
        forageStreak = 1;
      } else {
        next = pickAfterForage(forageStreak);

        if (next === "forage") {
          forageStreak += 1;
        } else {
          forageStreak = 0;
        }
      }

      const pause = pickPause(current);

      pauseTimer = window.setTimeout(() => {
        if (cancelled) return;

        startBehavior(next);
      }, pause);
    };

    const setup = async () => {
      const canvas = canvasRef.current;

      if (!canvas) return;

      const context = canvas.getContext("2d");

      if (!context) return;

      /*
       * Load both behaviors before starting.
       */
      const loaded = await Promise.all([
        loadBehavior("forage", context),
        loadBehavior("look", context),
      ]);

      if (cancelled) return;

      const [foragePlayer, lookPlayer] = loaded;

      playersRef.current = {
        forage: foragePlayer ?? undefined,
        look: lookPlayer ?? undefined,
      };

      /*
       * The "end" event is the real end of each APNG.
       */
      (
        [
          ["forage", foragePlayer],
          ["look", lookPlayer],
        ] as const
      ).forEach(([behavior, player]) => {
        if (!player) return;

        player.on("end", () => {
          if (cancelled) return;

          scheduleNextBehavior();
        });
      });

      if (cancelled) return;

      /*
       * Start with forage.
       */
      current = "forage";
      forageStreak = 1;

      startBehavior("forage");
    };

    void setup();

    return () => {
      cancelled = true;

      if (pauseTimer !== null) {
        window.clearTimeout(pauseTimer);
      }

      Object.values(playersRef.current).forEach(
        (player) => {
          player?.stop();
        },
      );
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={384}
      height={280}
      aria-hidden="true"
      className="absolute select-none pointer-events-none"
      style={{
        left,
        top,
        width: "min(3vw, 4.5dvh)",
        height: "auto",
        objectFit: "contain",
        transform: "translate(-50%, -100%)",
        zIndex: 100,
      }}
    />
  );
}
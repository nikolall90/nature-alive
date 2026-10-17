// Audio playback for the FOREST ALIVE hotspots.
//
// Audio plays only after a user clicks a hotspot. There is no autoplay,
// background, or ambient audio. Each click stops any sound currently playing
// before starting the requested one, so only one clip is audible at a time.

export type SoundId =
  | "blackbird"
  | "woodpecker"
  | "squirrel"
  | "frog"
  | "deer"
  | "stream"
  | "caterpillar"
  | "lousewort";

const FILE_MAP: Record<SoundId, string> = {
  blackbird: "/audio/blackbird.wav",
  woodpecker: "/audio/woodpecker.wav",
  squirrel: "/audio/squirrel.mp3",
  frog: "/audio/frog.wav",
  deer: "/audio/red-deer-cervus-elaphus.mp3",
  stream: "/audio/stream.wav",
  caterpillar: "",
  lousewort: "",
};

let current: HTMLAudioElement | null = null;

export function playSound(id: SoundId): void {
  stopAll();

  const file = FILE_MAP[id];
  if (!file) return;

  const audio = new Audio(file);
  current = audio;

  audio.play().catch(() => {
    // Autoplay policy or missing file — silently ignore.
  });

  audio.addEventListener("ended", () => {
    if (current === audio) current = null;
    audio.src = "";
  });
}

export function stopAll(): void {
  if (current) {
    current.pause();
    current.currentTime = 0;
    current.src = "";
    current = null;
  }
}

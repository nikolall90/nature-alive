import type { SoundId } from "./audio";

export interface Hotspot {
  id: SoundId;
  label: string;
  // Position as a percentage of the original photograph dimensions.
  x: number;
  y: number;
  // Size of the clickable area as a percentage of image width.
  radius: number;
}

export const HOTSPOTS: Hotspot[] = [
  {
    id: "blackbird",
    label: "BLACKBIRD",
    x: 35,
    y: 54,
    radius: 1.8,
  },
  {
    id: "woodpecker",
    label: "GREAT SPOTTED WOODPECKER",
    x: 49.88,
    y: 43,
    radius: 1.8,
  },
  {
    id: "squirrel",
    label: "SQUIRREL",
    x: 85,
    y: 52,
    radius: 2.2,
  },
  {
    id: "frog",
    label: "FROG",
    x: 61,
    y: 57,
    radius: 2.2,
  },
  {
    id: "deer",
    label: "DEER",
    x: 48,
    y: 42,
    radius: 3.25,
  },
  {
    id: "caterpillar",
    label: "CATERPILLAR",
    x: 10.5,
    y: 67.0,
    radius: 1.8,
  },
  {
    id: "lousewort",
    label: "KARKONOSZE LOUSEWORT",
    x: 42,
    y: 79,
    radius: 1.8,
  },
];

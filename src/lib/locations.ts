export type LocationId = "karkonosze" | "serengeti" | "glencoe" | "dolomites";

export interface LocationDef {
  id: LocationId;
  label: string;
  region: string;
  // Marker position as percentages of the world map image.
  marker: { left: number; top: number };
  // localStorage flags that must all be "true" to unlock; empty = always unlocked.
  unlockFlags: string[];
}

export const CRYSTAL_STORAGE_KEY = "forestAliveCrystalCollected";

export const LOCATIONS: LocationDef[] = [
  {
    id: "karkonosze",
    label: "Karkonosze Mountains",
    region: "Poland",
    marker: { left: 47.65, top: 25.03 },
    unlockFlags: [],
  },
  {
    id: "serengeti",
    label: "Serengeti",
    region: "Tanzania",
    marker: { left: 53.11, top: 51.17 },
    unlockFlags: [],
  },
  {
    id: "glencoe",
    label: "Glencoe",
    region: "Scotland",
    marker: { left: 41.8, top: 22.0 },
    unlockFlags: [],
  },
  {
    id: "dolomites",
    label: "Dolomites",
    region: "Italy",
    marker: { left: 46.4, top: 27.4 },
    unlockFlags: [],
  },
];

export function isLocationUnlocked(location: LocationDef): boolean {
  if (location.unlockFlags.length === 0) return true;
  try {
    return location.unlockFlags.every(
      (flag) => localStorage.getItem(flag) === "true",
    );
  } catch {
    return false;
  }
}

export function getUnlockedLocationIds(): Set<LocationId> {
  return new Set(
    LOCATIONS.filter(isLocationUnlocked).map((location) => location.id),
  );
}

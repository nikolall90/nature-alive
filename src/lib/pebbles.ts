const STORAGE_KEY = "forestAlivePebbles";

export type PebbleId = string;

export function getDiscoveredPebbles(): PebbleId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function discoverPebble(id: PebbleId): void {
  const current = getDiscoveredPebbles();
  if (current.includes(id)) return;
  current.push(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

import { useState } from "react";
import ForestScene from "@/components/ForestScene";
import KarkonoszeCleanScene from "@/components/KarkonoszeCleanScene";
import SerengetiScene from "@/components/SerengetiScene";
import GlencoeScene from "@/components/GlencoeScene";
import DolomitesScene from "@/components/DolomitesScene";
import WorldMap from "@/components/WorldMap";
import { getUnlockedLocationIds, type LocationId } from "@/lib/locations";

type ActiveScene = LocationId | null;

export default function App() {
  const [activeScene, setActiveScene] = useState<ActiveScene>(null);
  const [unlocked, setUnlocked] = useState<Set<LocationId>>(() =>
    getUnlockedLocationIds(),
  );

  const refreshUnlocks = () => {
    setUnlocked(getUnlockedLocationIds());
  };

  return (
    <>
      <div className={activeScene === null ? "block" : "hidden"}>
        <WorldMap
          unlockedLocations={unlocked}
          onLocationSelect={(id) => setActiveScene(id as ActiveScene)}
        />
      </div>
      {activeScene === "karkonosze" && (
        <KarkonoszeCleanScene onWorldMapSelect={() => {
          refreshUnlocks();
          setActiveScene(null);
        }} />
      )}
      {activeScene === "serengeti" && (
        <SerengetiScene onWorldMapSelect={() => {
          refreshUnlocks();
          setActiveScene(null);
        }} />
      )}
      {activeScene === "glencoe" && (
        <GlencoeScene onWorldMapSelect={() => {
          refreshUnlocks();
          setActiveScene(null);
        }} />
      )}
      {activeScene === "dolomites" && (
        <DolomitesScene onWorldMapSelect={() => {
          refreshUnlocks();
          setActiveScene(null);
        }} />
      )}
    </>
  );
}

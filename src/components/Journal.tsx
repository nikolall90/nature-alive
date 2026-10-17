import { useState } from "react";
import { X, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";

interface JournalProps {
  onClose: () => void;
}

interface Slot {
  type: "natural" | "crystal";
  commonName: string;
  scientificName: string;
  journalImage: string;
  fieldNote: string;
}

const SLOTS: Slot[] = [
  { type: "natural", commonName: "BLACKBIRD", scientificName: "Turdus merula", journalImage: "/blackbird-turdus-merula-journal.png", fieldNote: "The blackbird is easy to hear among the trees, though much harder to find. Its song seems to belong naturally to these old forests. I wonder how many others I have passed without ever noticing." },
  { type: "natural", commonName: "GREAT SPOTTED WOODPECKER", scientificName: "Dendrocopos major", journalImage: "/great-spotted-woodpecker-dendrocopos-major-journal.png", fieldNote: "The sound came first. Three or four sharp knocks, then silence. I waited, and eventually saw the woodpecker moving around the trunk of an old spruce." },
  { type: "natural", commonName: "RED SQUIRREL", scientificName: "Sciurus vulgaris", journalImage: "/red-squirrel-sciurus-vulgaris-journal.png", fieldNote: "Gone before I could get a proper look. Just a flash of russet between the branches. I suspect it knows these woods better than I ever will." },
  { type: "natural", commonName: "COMMON FROG", scientificName: "Rana temporaria", journalImage: "/common-frog-rana-temporaria-journal.png", fieldNote: "Almost stepped over it. It was sitting completely still among the wet leaves, looking more like a stone than a frog." },
  { type: "natural", commonName: "RED DEER", scientificName: "Cervus elaphus", journalImage: "/red-deer-cervus-elaphus-journal.png", fieldNote: "I saw the deer from a distance, at the edge of the clearing. It didn't move. Neither did I. For a few seconds the whole place seemed to be holding its breath." },
  { type: "natural", commonName: "CATERPILLAR", scientificName: "Psodos quadrifaria sudetica", journalImage: "/karkonosze-psodos-quadrifaria-sudetica-journal.png", fieldNote: "Hard to believe that this tiny caterpillar will one day become such a beautifully patterned moth." },
  { type: "natural", commonName: "KARKONOSZE LOUSEWORT", scientificName: "Pedicularis sudetica", journalImage: "/karkonosze-pedicularis-sudetica-journal.png", fieldNote: "I almost walked past this one. Its small purple flowers were hidden among the grass, and the plant looked strangely delicate against the mountain slopes. I later learned that it is one of the rare plants found here, surviving in places where the forest gives way to open ground." },
  { type: "crystal", commonName: "QUARTZ CRYSTAL", scientificName: "SiO₂", journalImage: "/karkonosze-quartz-crystal-journal.png", fieldNote: "A small piece of quartz among the darker stones. I was surprised to find that it can keep a trace of the natural radiation around it, almost like a memory of where it has been." },
];

type PageContent =
  | { kind: "title" }
  | { kind: "location" }
  | { kind: "discovery"; slot: Slot }
  | { kind: "blank" };

interface Spread {
  left: PageContent;
  right: PageContent;
}

const SPREADS: Spread[] = (() => {
  const spreads: Spread[] = [
    { left: { kind: "title" }, right: { kind: "location" } },
    { left: { kind: "discovery", slot: SLOTS[0] }, right: { kind: "discovery", slot: SLOTS[1] } },
    { left: { kind: "discovery", slot: SLOTS[2] }, right: { kind: "discovery", slot: SLOTS[3] } },
    { left: { kind: "discovery", slot: SLOTS[4] }, right: { kind: "discovery", slot: SLOTS[5] } },
    { left: { kind: "discovery", slot: SLOTS[6] }, right: { kind: "discovery", slot: SLOTS[7] } },
  ];
  return spreads;
})();

function PlaceholderSlot() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        className="text-[#c4baa6]"
        style={{
          width: "clamp(2.4rem,6vw,4rem)",
          height: "auto",
          opacity: 0.35,
        }}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M28 38c4-8 14-10 20-5s4 14-2 17-16 1-18-7" />
        <path d="M55 30c6-2 14 2 16 9s-4 14-11 13" />
        <path d="M35 58c-3 5 0 12 6 13s12-3 11-10" />
        <path d="M60 62c5 1 9 5 8 10" />
        <path d="M42 72c3 2 8 2 11 0" />
      </svg>
      <HelpCircle
        size={15}
        strokeWidth={1}
        className="mt-3 text-[#c4baa6]"
        style={{ opacity: 0.3 }}
      />
      <p
        className="mt-2.5 font-sans text-[#b0a690] text-[clamp(0.5rem,1.1vw,0.62rem)] tracking-[0.1em] italic"
        style={{ opacity: 0.55 }}
      >
        Something is missing…
      </p>
    </div>
  );
}

function PageBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent 0, transparent 2px, rgba(180,165,135,0.014) 2px, rgba(180,165,135,0.014) 3px), repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(160,145,115,0.008) 3px, rgba(160,145,115,0.008) 4px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0, transparent 31px, rgba(140,125,95,0.035) 31px, rgba(140,125,95,0.035) 32px)",
        }}
      />
    </>
  );
}

function TitlePage() {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center"
      style={{
        background:
          "linear-gradient(170deg, #f8f2e4 0%, #f2ead7 50%, #ede4ce 100%)",
      }}
    >
      <PageBackground />
      <div className="relative flex flex-col items-center px-[clamp(1.5rem,4vw,3rem)] text-center">
        <p
          className="font-serif text-[#8a7d62] text-[clamp(0.78rem,1.9vw,1.2rem)] tracking-[0.22em] uppercase"
          style={{ opacity: 0.9, fontWeight: 500 }}
        >
          Nature Alive
        </p>
        <div
          className="mt-4 h-px w-[clamp(2.5rem,6vw,4rem)]"
          style={{ background: "rgba(140,125,95,0.25)" }}
        />
        <p
          className="mt-5 font-serif text-[#6b5d42] text-[clamp(0.68rem,1.5vw,0.95rem)] tracking-[0.06em] italic"
          style={{ opacity: 0.8, fontWeight: 400 }}
        >
          Notes from the living world
        </p>
    
      </div>
    </div>
  );
}

function LocationPage() {
  return (
    <div
      className="relative flex flex-1 flex-col"
      style={{
        background:
          "linear-gradient(170deg, #f8f2e4 0%, #f2ead7 50%, #ede4ce 100%)",
      }}
    >
      <PageBackground />
      <div className="relative flex flex-col items-center px-[clamp(1.2rem,3vw,2.4rem)] pt-[clamp(2rem,6vh,3rem)]">
        <div className="flex w-full flex-col items-center">
          <h2
            className="font-serif text-[#4a3f2e] text-[clamp(0.78rem,1.8vw,1.1rem)] tracking-[0.32em] uppercase text-center"
            style={{ fontWeight: 400 }}
          >
            Karkonosze Mountains
          </h2>
          <div
            className="mt-3 h-px w-[clamp(2rem,5vw,3rem)]"
            style={{ background: "rgba(140,125,95,0.2)" }}
          />
          <p
            className="mt-3 font-serif text-[#7a6d54] text-[clamp(0.58rem,1.3vw,0.78rem)] tracking-[0.28em] uppercase"
            style={{ fontWeight: 400 }}
          >
            Field Notes
          </p>
        </div>
        {/* Mountain illustration — transparent, no frame or shadow */}
        <img
          src="/karkonosze-mountains-journal-sketch.png"
          alt="Karkonosze mountains sketch"
          style={{
            width: "clamp(75%,26vw,90%)",
            height: "auto",
            marginTop: "clamp(0.8rem,2.5vh,1.6rem)",
            opacity: 0.92,
          }}
        />
        {/* Journal entry text — directly below illustration, left-aligned */}
        <p
          className="mt-[clamp(1rem,3vh,1.8rem)] font-serif text-[#5c4f3a] italic text-left"
          style={{
            lineHeight: 1.75,
            opacity: 0.82,
            width: "clamp(65%,22vw,75%)",
            fontWeight: 400,
            fontSize: "16px",
          }}
        >
          The Karkonosze are not as quiet as they first appear. Beneath the
          mountain winds and ancient forests, something of the past still
          survives. I have decided to stay a little longer and see what else
          these mountains might reveal.
        </p>
      </div>
    </div>
  );
}

function DiscoveryPage({ slot }: { slot: Slot }) {
  return (
    <div
      className="relative flex flex-1 flex-col"
      style={{
        background:
          "linear-gradient(170deg, #f8f2e4 0%, #f2ead7 50%, #ede4ce 100%)",
      }}
    >
      <PageBackground />
      <div className="relative flex flex-1 flex-col items-center justify-center p-[clamp(1.2rem,3vw,2.4rem)] pt-[clamp(1.6rem,4vh,2.6rem)]">
        <img
          src={slot.journalImage}
          alt={slot.commonName}
          draggable={false}
          style={{
            width:
  slot.commonName === "GREAT SPOTTED WOODPECKER"
    ? "clamp(42%,13.5vw,61%)"
    : slot.commonName === "KARKONOSZE LOUSEWORT"
      ? "clamp(38%,12vw,56%)"
      : "clamp(50%,16vw,72%)",
            height: "auto",
            objectFit: "contain",
            opacity: 0.92,
          }}
        />
        <div
          className="mt-[clamp(0.8rem,2vh,1.2rem)] h-px w-[clamp(2rem,5vw,3rem)]"
          style={{ background: "rgba(140,125,95,0.2)" }}
        />
        <h3
          className="mt-[clamp(0.6rem,1.5vh,1rem)] font-serif text-[#4a3f2e] text-[clamp(0.62rem,1.5vw,0.88rem)] tracking-[0.18em] uppercase text-center"
          style={{ fontWeight: 500 }}
        >
          {slot.commonName}
        </h3>
        <p
          className="mt-1.5 font-serif text-[#7a6d54] text-[clamp(0.58rem,1.3vw,0.78rem)] italic text-center"
          style={{ fontWeight: 400, opacity: 0.8 }}
        >
          {slot.scientificName}
        </p>
        <div
          className="mt-[clamp(0.6rem,1.5vh,1rem)] h-px w-[clamp(1.5rem,4vw,2.5rem)]"
          style={{ background: "rgba(140,125,95,0.15)" }}
        />
        <p
          className="mt-[clamp(0.5rem,1.2vh,0.8rem)] font-serif text-[#5c4f3a] italic text-left"
          style={{
            lineHeight: 1.75,
            opacity: 0.75,
            fontWeight: 400,
            fontSize: "16px",
            width: "clamp(60%,20vw,78%)",
          }}
        >
          {slot.fieldNote}
        </p>
      </div>
    </div>
  );
}

function BlankPage() {
  return (
    <div
      className="relative flex flex-1 flex-col"
      style={{
        background:
          "linear-gradient(170deg, #f8f2e4 0%, #f2ead7 50%, #ede4ce 100%)",
      }}
    >
      <PageBackground />
    </div>
  );
}

function renderPage(content: PageContent) {
  switch (content.kind) {
    case "title":
      return <TitlePage />;
    case "location":
      return <LocationPage />;
    case "discovery":
      return <DiscoveryPage slot={content.slot} />;
    case "blank":
      return <BlankPage />;
  }
}

export default function Journal({ onClose }: JournalProps) {
  const [spread, setSpread] = useState(0);
  const totalSpreads = SPREADS.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(8, 10, 8, 0.6)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div
        className="relative flex flex-col"
        style={{
          width: "88vw",
          height: "86vh",
          maxWidth: "1180px",
          maxHeight: "840px",
          borderRadius: "3px",
          boxShadow:
            "0 2px 6px rgba(0,0,0,0.1), 0 16px 50px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.4) inset",
          overflow: "hidden",
        }}
      >
        {/* Open book — two pages with central gutter, no header */}
        <div className="relative flex flex-1 overflow-hidden">
          {/* Left page */}
          {renderPage(SPREADS[spread].left)}

          {/* Central gutter / book fold */}
          <div
            className="relative z-10 flex-shrink-0"
            style={{
              width: "clamp(10px,1.5vw,18px)",
              background:
                "linear-gradient(90deg, rgba(120,108,85,0.1) 0%, rgba(70,62,48,0.18) 45%, rgba(120,108,85,0.1) 100%)",
              boxShadow:
                "inset 2px 0 5px rgba(0,0,0,0.05), inset -2px 0 5px rgba(0,0,0,0.05)",
            }}
          />

          {/* Right page */}
          {renderPage(SPREADS[spread].right)}

          {/* Outer page-edge shadows */}
          <div
            className="pointer-events-none absolute left-0 top-0 h-full"
            style={{
              width: "clamp(8px,1.2vw,14px)",
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.06), transparent)",
            }}
          />
          <div
            className="pointer-events-none absolute right-0 top-0 h-full"
            style={{
              width: "clamp(8px,1.2vw,14px)",
              background:
                "linear-gradient(270deg, rgba(0,0,0,0.06), transparent)",
            }}
          />
        </div>

        {/* Spread navigation */}
        {spread > 0 && (
          <button
            type="button"
            onClick={() => setSpread((s) => Math.max(0, s - 1))}
            aria-label="Previous spread"
            className="absolute bottom-[clamp(0.8rem,2vh,1.4rem)] left-[clamp(1rem,2.5vw,1.8rem)] z-20 flex items-center gap-1.5 font-sans text-[clamp(0.56rem,1.2vw,0.68rem)] uppercase tracking-[0.18em] text-[#8a7d62] transition-colors hover:text-[#5a4e38]"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
            <span>Previous</span>
          </button>
        )}
        {spread < totalSpreads - 1 && (
          <button
            type="button"
            onClick={() => setSpread((s) => Math.min(totalSpreads - 1, s + 1))}
            aria-label="Next spread"
            className="absolute bottom-[clamp(0.8rem,2vh,1.4rem)] right-[clamp(1rem,2.5vw,1.8rem)] z-20 flex items-center gap-1.5 font-sans text-[clamp(0.56rem,1.2vw,0.68rem)] uppercase tracking-[0.18em] text-[#8a7d62] transition-colors hover:text-[#5a4e38]"
          >
            <span>Next</span>
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        )}

        {/* Spread indicator */}
        <div className="pointer-events-none absolute bottom-[clamp(0.8rem,2vh,1.4rem)] left-1/2 -translate-x-1/2 z-20">
          <p
            className="font-sans text-[#a89e88] text-[clamp(0.5rem,1vw,0.6rem)] tracking-[0.2em] uppercase"
            style={{ opacity: 0.5 }}
          >
            {spread + 1} / {totalSpreads}
          </p>
        </div>

        {/* Close control */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close journal"
          className="absolute right-5 top-5 z-30 flex items-center gap-2 font-sans text-[0.62rem] uppercase tracking-[0.2em] text-[#8a7d62] transition-colors hover:text-[#5a4e38]"
        >
          <span>Close</span>
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

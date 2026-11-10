import type { SitePhoto } from "@/interfaces/portal-interface";

const tones = [
  "from-orange-200 to-amber-100",
  "from-stone-300 to-stone-100",
  "from-orange-300 to-rose-100",
  "from-amber-200 to-stone-100",
  "from-neutral-300 to-orange-100",
  "from-rose-200 to-orange-50",
];

export const mockPhotos: SitePhoto[] = [
  {
    id: "ph-1",
    projectId: 101,
    caption: "First fix electrics: kitchen wall",
    takenBy: "Dan Price",
    takenAt: "2026-11-05",
    tone: tones[0],
  },
  {
    id: "ph-2",
    projectId: 101,
    caption: "Steel goalpost installed",
    takenBy: "Tom Reeves",
    takenAt: "2026-10-02",
    tone: tones[1],
  },
  {
    id: "ph-3",
    projectId: 101,
    caption: "Roof membrane & battens",
    takenBy: "Tom Reeves",
    takenAt: "2026-10-08",
    tone: tones[2],
  },
  {
    id: "ph-4",
    projectId: 102,
    caption: "Loft floor joists strengthened",
    takenBy: "Lucy Grant",
    takenAt: "2026-10-29",
    tone: tones[3],
  },
  {
    id: "ph-5",
    projectId: 103,
    caption: "Kitchen units fitted",
    takenBy: "Marcus Hale",
    takenAt: "2026-11-04",
    tone: tones[4],
  },
  {
    id: "ph-6",
    projectId: 104,
    caption: "Foundation trench excavated",
    takenBy: "Lucy Grant",
    takenAt: "2026-11-03",
    tone: tones[5],
  },
  {
    id: "ph-7",
    projectId: 101,
    caption: "Underfloor insulation laid",
    takenBy: "Dan Price",
    takenAt: "2026-09-15",
    tone: tones[1],
  },
  {
    id: "ph-8",
    projectId: 101,
    caption: "Plumbing manifold",
    takenBy: "Dan Price",
    takenAt: "2026-11-06",
    tone: tones[0],
  },
];

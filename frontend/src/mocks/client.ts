import type { ProgressUpdate } from "@/interfaces/portal";
import { mockPhotos } from "./evidence";

export const clientWelcome = {
  clientName: "Sarah",
  headline: "Your rear extension is 58% complete",
  summary:
    "First fix electrics and plumbing are under way this week. Once Tom has completed the pre-plaster check on 13 November, the plasterers start on 30 November.",
  contacts: [
    {
      name: "Tom Reeves",
      role: "Your site manager",
      phone: "07700 900222",
      email: "tom@extendout.co.uk",
    },
    {
      name: "Hannah Cole",
      role: "Architectural designer",
      phone: "07700 900444",
      email: "hannah@extendout.co.uk",
    },
    {
      name: "ExtendOut office",
      role: "Accounts & general",
      phone: "01306 000000",
      email: "hello@extendout.co.uk",
    },
  ],
};

const photosFor = (ids: string[]) =>
  mockPhotos.filter((p) => ids.includes(p.id));

export const mockProgressUpdates: ProgressUpdate[] = [
  {
    id: "pu-1",
    date: "2026-11-06",
    title: "Week 18: First fix under way",
    summary:
      "Electrician has chased walls for the kitchen island feed and run cables to the new socket positions agreed in VAR-013. Plumbing manifold for the underfloor heating is in place.",
    photos: photosFor(["ph-1", "ph-8"]),
  },
  {
    id: "pu-2",
    date: "2026-10-09",
    title: "Week 14: Watertight!",
    summary:
      "Roof membrane, battens and tiles are complete, and temporary rooflight covers are fitted. The extension is now fully weathertight ahead of the autumn rain.",
    photos: photosFor(["ph-3", "ph-2"]),
  },
  {
    id: "pu-3",
    date: "2026-09-15",
    title: "Week 10: Floor slab & insulation",
    summary:
      "PIR insulation laid over the slab, ready for screed and underfloor heating.",
    photos: photosFor(["ph-7"]),
  },
];

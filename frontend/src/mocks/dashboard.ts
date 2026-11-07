import type { ActivityEntry } from "@/interfaces/portal-interface";

export const mockActivity: ActivityEntry[] = [
  {
    id: "a-1",
    who: "Dan Price",
    action: "uploaded 4 photos to",
    target: "Surrey Rear Extension",
    at: "2026-11-06T16:42:00",
  },
  {
    id: "a-2",
    who: "Lucy Grant",
    action: "raised issue on",
    target: "Reigate Wraparound Extension",
    at: "2026-11-06T11:15:00",
  },
  {
    id: "a-5",
    who: "Hannah Cole",
    action: "uploaded revised drawings to",
    target: "Guildford Loft Conversion",
    at: "2026-11-01T14:12:00",
  },
  {
    id: "a-6",
    who: "Marcus Hale",
    action: "marked snag resolved on",
    target: "Epsom Kitchen Remodel",
    at: "2026-10-31T17:48:00",
  },
];

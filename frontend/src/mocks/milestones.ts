import type { Milestone } from "@/interfaces/portal-interface";

export const mockMilestones: Milestone[] = [
  {
    id: "m-1",
    projectId: 101,
    title: "Planning approved",
    date: "2026-05-18",
    status: "Complete",
  },
  {
    id: "m-2",
    projectId: 101,
    title: "Foundations signed off",
    date: "2026-07-31",
    status: "Complete",
  },
  {
    id: "m-3",
    projectId: 101,
    title: "Roof watertight",
    date: "2026-10-09",
    status: "Complete",
  },
  {
    id: "m-4",
    projectId: 101,
    title: "First fix complete",
    date: "2026-11-13",
    status: "In progress",
  },
  {
    id: "m-5",
    projectId: 101,
    title: "Plastering complete",
    date: "2026-12-11",
    status: "Upcoming",
  },
  {
    id: "m-6",
    projectId: 101,
    title: "Kitchen & bifolds installed",
    date: "2027-01-15",
    status: "Upcoming",
  },
  {
    id: "m-7",
    projectId: 101,
    title: "Handover",
    date: "2027-01-29",
    status: "Upcoming",
  },
  {
    id: "m-8",
    projectId: 104,
    title: "Foundations poured",
    date: "2026-11-06",
    status: "Delayed",
  },
];

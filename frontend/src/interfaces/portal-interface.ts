// Types for mock-backed portal features (no backend yet).
// Projects themselves come from the API: see ./project-interface.ts.

export interface Milestone {
  id: string;
  projectId: number;
  title: string;
  date: string;
  status: "Complete" | "In progress" | "Upcoming" | "Delayed";
}

export interface SitePhoto {
  id: string;
  projectId: number;
  caption: string;
  takenBy: string;
  takenAt: string;
  tone: string; // tailwind gradient classes for placeholder tile
}

export interface Inspection {
  id: string;
  projectId: number;
  title: string;
  inspector: string;
  date: string;
  status: "Passed" | "Scheduled" | "Failed";
}

export interface Issue {
  id: string;
  projectId: number;
  title: string;
  raisedBy: string;
  raisedAt: string;
  priority: "Low" | "Medium" | "High";
  status: "Open" | "In progress" | "Resolved";
}

export interface ProgressUpdate {
  id: string;
  date: string;
  title: string;
  summary: string;
  photos: SitePhoto[];
}

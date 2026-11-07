// Types for mock-backed portal features (no backend yet).
// Projects themselves come from the API: see ./project.ts.

export type PlanBucket = "Now" | "Next" | "Then";

export interface PlanItem {
  id: string;
  projectId: string;
  title: string;
  bucket: PlanBucket;
  trade: string;
  start: string;
  end: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  date: string;
  status: "Complete" | "In progress" | "Upcoming" | "Delayed";
}

export type MaterialStatus = "Required" | "RFQ sent" | "Ordered" | "Delivered";

export interface MaterialItem {
  id: string;
  projectId: string;
  item: string;
  quantity: string;
  supplier?: string;
  cost?: number;
  needBy: string;
  status: MaterialStatus;
}

export interface SitePhoto {
  id: string;
  projectId: string;
  caption: string;
  takenBy: string;
  takenAt: string;
  tone: string; // tailwind gradient classes for placeholder tile
}

export interface Inspection {
  id: string;
  projectId: string;
  title: string;
  inspector: string;
  date: string;
  status: "Passed" | "Scheduled" | "Failed";
}

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  raisedBy: string;
  raisedAt: string;
  priority: "Low" | "Medium" | "High";
  status: "Open" | "In progress" | "Resolved";
}

export type TeamRole = "Admin" | "Manager" | "Field";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  trade: string;
  projectIds: string[];
  phone: string;
}

export interface ActivityEntry {
  id: string;
  who: string;
  action: string;
  target: string;
  at: string;
}

export interface ProgressUpdate {
  id: string;
  date: string;
  title: string;
  summary: string;
  photos: SitePhoto[];
}

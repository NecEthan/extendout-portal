import {
  FolderKanban,
  Home,
  Images,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/interfaces/user-interface";
import { applicationRoutes } from "@/utils/applicationRoutes";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  /** Roles that see this section in the sidebar. */
  roles: UserRole[];
  items: NavItem[];
}

// Both roles get the Projects link; the API lists all projects for admins and
// only their member projects for builders and clients.
const projectsItem: NavItem = {
  href: applicationRoutes.projects,
  label: "Projects",
  icon: FolderKanban,
};

export const navSections: NavSection[] = [
  {
    title: "Admin",
    roles: ["admin"],
    items: [
      {
        href: applicationRoutes.dashboard,
        label: "Dashboard",
        icon: LayoutDashboard,
      },
      projectsItem,
      {
        href: applicationRoutes.team,
        label: "Team",
        icon: Users,
      },
    ],
  },
  {
    title: "Client view",
    roles: ["builder", "client"],
    items: [
      { href: applicationRoutes.clientOverview, label: "Overview", icon: Home },
      {
        href: applicationRoutes.progress,
        label: "Progress Photos",
        icon: Images,
      },
      projectsItem,
    ],
  },
];

const allItems = navSections.flatMap((s) => s.items);

/** Longest-prefix match so /client/progress beats /client. */
export function findActiveNavItem(pathname: string): NavItem | undefined {
  return allItems
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}

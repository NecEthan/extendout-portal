import {
  CalendarRange,
  FolderKanban,
  Home,
  Images,
  LayoutDashboard,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react";
import { applicationRoutes } from "@/utils/applicationRoutes";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Workspace",
    items: [
      {
        href: applicationRoutes.dashboard,
        label: "Dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Office",
    items: [
      {
        href: applicationRoutes.projects,
        label: "Projects",
        icon: FolderKanban,
      },
      {
        href: applicationRoutes.planning,
        label: "Planning",
        icon: CalendarRange,
      },
      { href: applicationRoutes.materials, label: "Materials", icon: Package },
      { href: applicationRoutes.team, label: "Team", icon: Users },
    ],
  },
  {
    title: "Client view",
    items: [
      { href: applicationRoutes.clientOverview, label: "Overview", icon: Home },
      {
        href: applicationRoutes.progress,
        label: "Progress Photos",
        icon: Images,
      },
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

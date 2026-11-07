"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { findActiveNavItem } from "./navConfig";

export function TopBar() {
  const pathname = usePathname();
  const { data: user } = useUser();
  const title = findActiveNavItem(pathname)?.label ?? "ExtendOut Portal";
  const initial = user?.email?.[0]?.toUpperCase() ?? "E";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <span className="font-heading text-base font-semibold">{title}</span>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid size-8 place-items-center rounded-md hover:bg-muted"
        >
          <Bell size={16} />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
        </button>
        <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initial}
        </span>
      </div>
    </header>
  );
}

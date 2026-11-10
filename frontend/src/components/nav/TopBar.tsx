"use client";

import { usePathname } from "next/navigation";
import { findActiveNavItem } from "./navConfig";

export function TopBar() {
  const pathname = usePathname();
  const title = findActiveNavItem(pathname)?.label ?? "ExtendOut Portal";

  return (
    <header className="flex h-14 shrink-0 items-center border-b bg-background px-6">
      <span className="font-heading text-base font-semibold">{title}</span>
    </header>
  );
}

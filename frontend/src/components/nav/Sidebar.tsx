"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { useLogout, useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";
import { findActiveNavItem, navSections } from "./navConfig";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useUser();
  const logoutMutation = useLogout();
  const activeHref = findActiveNavItem(pathname)?.href;
  // Nothing until the user has loaded, so the wrong role's links never flash.
  const sections = user
    ? navSections.filter((section) => section.roles.includes(user.role))
    : [];

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => router.replace(applicationRoutes.login),
    });
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5">
        <Image
          src="/extendout-logo.png"
          alt="ExtendOut Design | Build"
          width={621}
          height={182}
          priority
          className="h-auto w-40"
        />
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            <span className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              {section.title}
            </span>
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = href === activeHref;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-sidebar-primary bg-sidebar-accent font-medium text-white"
                      : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon
                    size={16}
                    className={active ? "text-sidebar-primary" : undefined}
                  />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border px-3 py-4">
        {user && (
          <span className="truncate px-3 text-xs text-white/50">
            {user.email}
          </span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

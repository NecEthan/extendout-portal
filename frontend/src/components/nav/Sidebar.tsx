"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LogOut, Menu, X } from "lucide-react";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { useLogout, useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";
import { findActiveNavItem, navSections } from "./navConfig";

function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/extendout-logo.png"
      alt="ExtendOut Design | Build"
      width={621}
      height={182}
      priority
      className={cn("h-auto", className)}
    />
  );
}

/** Links, user email and sign out. Shared by the desktop sidebar and the
 * phone menu. `onNavigate` runs when a link is followed (closes the menu). */
function NavContent({ onNavigate }: { onNavigate?: () => void }) {
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
    <>
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
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2.5 text-sm transition-colors md:py-2",
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
          className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white md:py-2"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );
}

/** Fixed sidebar on tablets and desktops (md and up). */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="px-5 py-5">
        <Logo className="w-40" />
      </div>
      <NavContent />
    </aside>
  );
}

/** Top bar with a menu button on phones (below md). The menu opens from the
 * left and closes when a link is followed, the close button, the backdrop or
 * Escape. */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <Logo className="w-28" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="-mr-2 rounded-md p-2 text-white/80 hover:bg-white/5 hover:text-white"
        >
          <Menu size={22} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <Logo className="w-32" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="-mr-2 rounded-md p-2 text-white/80 hover:bg-white/5 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>
            <NavContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

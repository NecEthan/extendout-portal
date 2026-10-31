"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { Button } from "@/components/ui/button";
import { useLogout, useUser } from "@/hooks/useUser";

const baseNavItems = [
  { href: applicationRoutes.documents, label: "Documents", icon: FileText },
  { href: applicationRoutes.search, label: "Search", icon: Search },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user, isError } = useUser();
  const logoutMutation = useLogout();

  useEffect(() => {
    if (isError) router.replace(applicationRoutes.login);
  }, [isError, router]);

  const navItems = baseNavItems;

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => router.replace(applicationRoutes.login),
    });
  }

  return (
    <aside className="flex flex-col w-56 min-h-screen border-r bg-background px-3 py-4">
      <span className="text-lg font-semibold px-2 mb-6">KnowledgeGuard</span>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Button
              key={href}
              variant="ghost"
              render={<Link href={href} />}
              className={`justify-start gap-2 ${active ? "bg-accent text-accent-foreground" : ""}`}
            >
              <Icon size={16} />
              {label}
            </Button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 pt-4 border-t">
        {user && (
          <span className="text-xs text-muted-foreground px-2 truncate">
            {user.email}
          </span>
        )}
        <Button
          variant="ghost"
          className="justify-start"
          onClick={handleLogout}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}

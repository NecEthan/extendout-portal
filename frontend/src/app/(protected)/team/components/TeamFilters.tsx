"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { INPUT_LIMITS } from "@/lib/inputLimits";
import { cn } from "@/lib/utils";
import type { TeamRoleFilter as RoleFilter } from "@/interfaces";

const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "builder", label: "Builders" },
  { value: "client", label: "Clients" },
];

/** Search by name or email, and show one role at a time. */
export function TeamFilters({
  search,
  onSearch,
  role,
  onRole,
  counts,
}: {
  search: string;
  onSearch: (search: string) => void;
  role: RoleFilter;
  onRole: (role: RoleFilter) => void;
  /** Undefined until the first results arrive. */
  counts?: Record<RoleFilter, number>;
}) {
  return (
    <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
      <div className="relative md:w-72">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search the team"
          placeholder="Search name or email"
          value={search}
          maxLength={INPUT_LIMITS.email}
          onChange={(e) => onSearch(e.target.value)}
          className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearch("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="Filter by role"
        className="grid grid-cols-4 gap-1 md:flex"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={role === f.value}
            onClick={() => onRole(f.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 md:px-3 text-sm whitespace-nowrap transition-colors",
              role === f.value
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
            {counts && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  role === f.value ? "opacity-80" : "opacity-70"
                )}
              >
                {counts[f.value]}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

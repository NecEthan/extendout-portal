import { Badge } from "@/components/ui/badge";
import type { Member, UserRole } from "@/interfaces";

const ROLE_VARIANT = {
  admin: "solid",
  builder: "default",
  client: "neutral",
} as const satisfies Record<UserRole, string>;

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  builder: "Builder",
  client: "Client",
};

export const ROLES: UserRole[] = ["admin", "builder", "client"];

export function roleLabel(role: UserRole): string {
  return ROLE_LABEL[role];
}

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge variant={ROLE_VARIANT[role]}>{ROLE_LABEL[role]}</Badge>;
}

export function displayName(person: Pick<Member, "name" | "email">): string {
  return person.name || person.email;
}

function initials(person: Pick<Member, "name" | "email">): string {
  const source = person.name || person.email.split("@")[0];
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Avatar initials, name and email. */
export function Person({
  person,
  isYou = false,
}: {
  person: Pick<Member, "name" | "email">;
  isYou?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
        {initials(person)}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">
          {displayName(person)}
          {isYou && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              (you)
            </span>
          )}
        </span>
        {person.name && (
          <span className="truncate text-xs text-muted-foreground">
            {person.email}
          </span>
        )}
      </div>
    </div>
  );
}

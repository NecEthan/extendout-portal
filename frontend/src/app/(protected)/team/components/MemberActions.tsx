"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayName } from "@/components/team/Person";
import { useDeleteTeamMember } from "@/hooks/useTeam";
import type { TeamMember } from "@/interfaces";
import { RowError } from "./RowError";

/** Edit and Delete for one row. Delete asks for confirmation in the row;
 * admins can't delete themselves (the backend refuses it too). */
export function MemberActions({
  member,
  isYou,
  onEdit,
}: {
  member: TeamMember;
  isYou: boolean;
  onEdit: () => void;
}) {
  const deleteMember = useDeleteTeamMember();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      {confirming ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm">Delete {displayName(member)}?</span>
          <Button
            size="sm"
            variant="destructive"
            disabled={deleteMember.isPending}
            onClick={() => deleteMember.mutate(member.id)}
          >
            {deleteMember.isPending ? "Deleting…" : "Delete"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setConfirming(false);
              deleteMember.reset();
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Edit ${member.email}`}
            title="Edit"
            onClick={onEdit}
          >
            <Pencil />
          </Button>
          {/* Keeps the Edit buttons lined up on your own row. */}
          {isYou ? (
            <span className="size-9 md:size-7" />
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete ${member.email}`}
              title="Delete"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
      <RowError source={deleteMember} fallback="Couldn't delete the user" />
    </>
  );
}

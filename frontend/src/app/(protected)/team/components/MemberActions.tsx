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
        <div className="flex items-center justify-end gap-2">
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
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={`Edit ${member.email}`}
            onClick={onEdit}
          >
            <Pencil /> Edit
          </Button>
          {!isYou && (
            <Button
              size="sm"
              variant="outline"
              aria-label={`Delete ${member.email}`}
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 /> Delete
            </Button>
          )}
        </div>
      )}
      <RowError source={deleteMember} fallback="Couldn't delete the user" />
    </>
  );
}

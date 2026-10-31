"use client";

import Link from "next/link";
import type { Document } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useDeleteDocument } from "@/hooks/useDocuments";
import { getErrorMessage } from "@/lib/errorMessage";

interface DocumentListProps {
  documents: Document[];
}

export function DocumentList({ documents }: DocumentListProps) {
  const deleteDocument = useDeleteDocument();

  if (documents.length === 0) {
    return <span className="text-sm text-muted-foreground">No documents yet.</span>;
  }

  const error = getErrorMessage(deleteDocument, "Delete failed");

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert message={error} />
      {documents.map((doc) => (
        <div
          key={doc.id}
          data-testid="document-row"
          className="flex items-center justify-between rounded-lg border px-4 py-3"
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium">{doc.title}</span>
              {doc.sensitivity === "SENSITIVE" && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Sensitive
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(doc.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/documents/${doc.id}/versions`}>
              <Button variant="outline" size="sm">
                Versions
              </Button>
            </Link>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteDocument.isPending && deleteDocument.variables === doc.id}
              onClick={() => deleteDocument.mutate(doc.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

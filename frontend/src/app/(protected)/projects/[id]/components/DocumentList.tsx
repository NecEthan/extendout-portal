"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import type { Document } from "@/interfaces";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useDeleteDocument } from "@/hooks/useDocuments";
import { documentDownloadUrl } from "@/lib/api/documents";
import { getErrorMessage } from "@/lib/errorMessage";
import { STATUS_STYLES } from "@/utils/documentStatus";
import { applicationRoutes } from "@/utils/applicationRoutes";

interface DocumentListProps {
  documents: Document[];
}

export function DocumentList({ documents }: DocumentListProps) {
  const deleteDocument = useDeleteDocument();

  if (documents.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">No documents yet.</span>
    );
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
              {doc.latest_version_status && (
                <span
                  data-testid="document-status"
                  className={`text-xs font-semibold rounded px-2 py-0.5 ${
                    STATUS_STYLES[doc.latest_version_status] ??
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {doc.latest_version_status}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(doc.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {doc.has_active_version && (
              <a
                href={documentDownloadUrl(doc.id)}
                download
                aria-label={`Download ${doc.title}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download /> Download
              </a>
            )}
            <Link
              href={applicationRoutes.documentVersions(doc.id, doc.project_id)}
            >
              <Button variant="outline" size="sm">
                Versions
              </Button>
            </Link>
            <Button
              variant="destructive"
              size="sm"
              disabled={
                deleteDocument.isPending && deleteDocument.variables === doc.id
              }
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

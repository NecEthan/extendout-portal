"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Eye } from "lucide-react";
import type { Document } from "@/interfaces";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
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
  const [previewing, setPreviewing] = useState<Document | null>(null);

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
          className="flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium break-words [overflow-wrap:anywhere]">
                {doc.title}
              </span>
              {doc.latest_version_status && (
                <span
                  data-testid="document-status"
                  className={`shrink-0 text-xs font-semibold rounded px-2 py-0.5 ${
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
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {doc.has_active_version && (
              <Button
                size="sm"
                aria-label={`Preview ${doc.title}`}
                onClick={() => setPreviewing(doc)}
              >
                <Eye /> Preview
              </Button>
            )}
            {doc.has_active_version && (
              <a
                href={documentDownloadUrl(doc.id)}
                download
                aria-label={`Download ${doc.title}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" })
                )}
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
      {previewing && (
        <DocumentPreview
          documentId={previewing.id}
          title={previewing.title}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}

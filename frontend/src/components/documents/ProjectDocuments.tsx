"use client";

import { useState } from "react";
import { UploadForm } from "@/components/documents/UploadForm";
import { DocumentList } from "@/components/documents/DocumentList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Pagination } from "@/components/ui/pagination";
import { useDocuments } from "@/hooks/useDocuments";
import { firstErrorMessage } from "@/lib/errorMessage";

const PAGE_SIZE = 20;

/** Upload, list and track processing of one project's documents. */
export function ProjectDocuments({ projectId }: { projectId: number }) {
  const [offset, setOffset] = useState(0);
  const documents = useDocuments(projectId, PAGE_SIZE, offset);

  const error = firstErrorMessage([[documents, "Failed to load documents"]]);

  if (!documents.data) {
    return <ErrorAlert message={error} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ErrorAlert message={error} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Upload document</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadForm projectId={projectId} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Project documents</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DocumentList documents={documents.data.items} />
            <Pagination
              offset={offset}
              limit={PAGE_SIZE}
              total={documents.data.total}
              onOffsetChange={setOffset}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

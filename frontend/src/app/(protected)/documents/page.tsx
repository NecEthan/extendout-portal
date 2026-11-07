"use client";

import { useState } from "react";
import { UploadForm } from "@/components/documents/UploadForm";
import { DocumentList } from "@/components/documents/DocumentList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Pagination } from "@/components/ui/pagination";
import { useUser } from "@/hooks/useUser";
import { useDocuments } from "@/hooks/useDocuments";
import { firstErrorMessage } from "@/lib/errorMessage";
import { PageHeader } from "@/components/portal/PageHeader";

const PAGE_SIZE = 20;

export default function DocumentsPage() {
  const [offset, setOffset] = useState(0);
  const user = useUser();
  const documents = useDocuments(PAGE_SIZE, offset);

  const error = firstErrorMessage([
    [user, "Failed to load your account"],
    [documents, "Failed to load documents"],
  ]);

  if (!documents.data || !user.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Documents" />
        <ErrorAlert message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Documents"
        description="Drawings, contracts, specifications and site records, versioned and searchable."
      />

      <ErrorAlert message={error} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Upload document</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadForm userRole={user.data.role} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your documents</CardTitle>
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

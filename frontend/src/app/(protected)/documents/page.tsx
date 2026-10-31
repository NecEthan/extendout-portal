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
      <div className="flex flex-col items-center py-12 px-4 gap-8">
        <div className="w-full max-w-2xl">
          <ErrorAlert message={error} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-12 px-4 gap-8">
      <div className="w-full max-w-2xl">
        <span className="text-2xl font-semibold">Documents</span>
      </div>

      <div className="w-full max-w-2xl">
        <ErrorAlert message={error} />
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Upload document</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm userRole={user.data.role} />
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl">
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
  );
}

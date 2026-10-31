"use client";

import { UploadForm } from "@/components/documents/UploadForm";
import { DocumentList } from "@/components/documents/DocumentList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useUser } from "@/hooks/useUser";
import { useDocuments } from "@/hooks/useDocuments";
import { firstErrorMessage } from "@/lib/errorMessage";

export default function DocumentsPage() {
  const user = useUser();
  const documents = useDocuments();

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
        <CardContent>
          <DocumentList documents={documents.data} />
        </CardContent>
      </Card>
    </div>
  );
}

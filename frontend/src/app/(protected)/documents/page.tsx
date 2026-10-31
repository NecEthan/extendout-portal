"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { UploadForm } from "@/components/documents/UploadForm";
import { DocumentList } from "@/components/documents/DocumentList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";
import { useDocuments } from "@/hooks/useDocuments";

export default function DocumentsPage() {
  const router = useRouter();
  const { data: user, isError: userError } = useUser();
  const { data: documents, isError: documentsError } = useDocuments();

  useEffect(() => {
    if (userError || documentsError) router.replace(applicationRoutes.login);
  }, [userError, documentsError, router]);

  if (!documents || !user) return null;

  return (
    <div className="flex flex-col items-center py-12 px-4 gap-8">
      <div className="w-full max-w-2xl">
        <span className="text-2xl font-semibold">Documents</span>
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Upload document</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm userRole={user.role} />
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Your documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentList documents={documents} />
        </CardContent>
      </Card>
    </div>
  );
}

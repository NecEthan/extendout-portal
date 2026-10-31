"use client";

import { useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useActivateDocumentVersion,
  useDocumentVersions,
  useUploadDocumentVersion,
} from "@/hooks/useDocumentVersions";
import { firstErrorMessage } from "@/lib/errorMessage";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PROCESSING: "bg-yellow-100 text-yellow-800",
  SUPERSEDED: "bg-gray-100 text-gray-500",
  FAILED: "bg-red-100 text-red-700",
  DELETED: "bg-gray-100 text-gray-400",
  REVIEW_REQUIRED: "bg-orange-100 text-orange-800",
};

export default function VersionHistoryPage() {
  const params = useParams<{ id: string }>();
  const documentId = params.id;
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const versionsQuery = useDocumentVersions(documentId);
  const uploadVersion = useUploadDocumentVersion(documentId);
  const activateVersion = useActivateDocumentVersion(documentId);

  function handleUploadVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    uploadVersion.mutate(file, {
      onSuccess: () => {
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      },
    });
  }

  const error = firstErrorMessage([
    [versionsQuery, "Failed to load versions"],
    [uploadVersion, "Upload failed"],
    [activateVersion, "Activation failed"],
  ]);

  if (!versionsQuery.data) {
    return (
      <div className="flex flex-col items-center py-12 px-4 gap-8">
        <div className="w-full max-w-2xl">
          <ErrorAlert message={error} />
        </div>
      </div>
    );
  }

  const versions = versionsQuery.data;

  return (
    <div className="flex flex-col items-center py-12 px-4 gap-8">
      <div className="w-full max-w-2xl flex items-center justify-between">
        <span className="text-2xl font-semibold">Version History</span>
        <Button
          variant="outline"
          onClick={() => router.push(applicationRoutes.documents)}
        >
          Back to documents
        </Button>
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Upload new version</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUploadVersion} className="flex flex-col gap-4">
            <ErrorAlert message={error} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="version-file">File</Label>
              <Input
                id="version-file"
                type="file"
                accept=".pdf,.docx,.txt"
                required
                ref={fileRef}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit" disabled={!file}>
              Upload new version
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <span className="text-sm text-muted-foreground">No versions yet.</span>
          ) : (
            <div className="flex flex-col gap-3">
              {versions.map((v) => (
                <div
                  key={v.id}
                  data-testid="version-row"
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    v.status === "ACTIVE" ? "border-green-400" : ""
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">v{v.version_number}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!["ACTIVE", "PROCESSING", "DELETED", "FAILED"].includes(v.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => activateVersion.mutate(v.id)}
                      >
                        Set as active
                      </Button>
                    )}
                    <span
                      data-testid="version-status"
                      className={`text-xs font-semibold rounded px-2 py-1 ${
                        STATUS_STYLES[v.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

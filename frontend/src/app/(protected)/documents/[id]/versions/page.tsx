"use client";

import { useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Pagination } from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useActivateDocumentVersion,
  useDocumentVersions,
  useUploadDocumentVersion,
} from "@/hooks/useDocumentVersions";
import { firstErrorMessage } from "@/lib/errorMessage";
import { STATUS_STYLES } from "@/utils/documentStatus";

const PAGE_SIZE = 20;

export default function VersionHistoryPage() {
  const params = useParams<{ id: string }>();
  const documentId = params.id;
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [offset, setOffset] = useState(0);

  const versionsQuery = useDocumentVersions(documentId, PAGE_SIZE, offset);
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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <ErrorAlert message={error} />
      </div>
    );
  }

  const versions = versionsQuery.data.items;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Version History
        </h1>
        <Button
          variant="outline"
          onClick={() => router.push(applicationRoutes.documents)}
        >
          Back to documents
        </Button>
      </div>

      <Card>
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
            <Button type="submit" disabled={uploadVersion.isPending || !file}>
              {uploadVersion.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {uploadVersion.isPending ? "Uploading…" : "Upload new version"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {versions.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No versions yet.
            </span>
          ) : (
            <div className="flex flex-col gap-3">
              {versions.map((v) => (
                <div
                  key={v.id}
                  data-testid="version-row"
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    v.status === "ACTIVE" ? "border-success" : ""
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">v{v.version_number}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!["ACTIVE", "PROCESSING", "DELETED", "FAILED"].includes(
                      v.status
                    ) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          activateVersion.isPending &&
                          activateVersion.variables === v.id
                        }
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
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            total={versionsQuery.data.total}
            onOffsetChange={setOffset}
          />
        </CardContent>
      </Card>
    </div>
  );
}

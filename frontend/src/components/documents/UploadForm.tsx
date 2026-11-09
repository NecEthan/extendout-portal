"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useUploadDocument } from "@/hooks/useDocuments";
import { getErrorMessage, UPLOAD_RATE_LIMITED } from "@/lib/errorMessage";

interface UploadFormProps {
  projectId: number;
}

export function UploadForm({ projectId }: UploadFormProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadDocument = useUploadDocument(projectId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    uploadDocument.mutate(
      { file, title: title || file.name },
      {
        onSuccess: () => {
          setTitle("");
          setFile(null);
          if (fileRef.current) fileRef.current.value = "";
        },
      }
    );
  }

  const error = getErrorMessage(uploadDocument, "Upload failed", {
    429: UPLOAD_RATE_LIMITED,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ErrorAlert message={error} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="upload-title">Title</Label>
        <Input
          id="upload-title"
          type="text"
          placeholder="Leave blank to use filename"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="upload-file">File</Label>
        <Input
          id="upload-file"
          type="file"
          accept=".pdf,.docx,.xlsx"
          required
          ref={fileRef}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <Button type="submit" disabled={uploadDocument.isPending || !file}>
        {uploadDocument.isPending && (
          <Loader2 className="size-4 animate-spin" />
        )}
        {uploadDocument.isPending ? "Uploading…" : "Upload document"}
      </Button>
    </form>
  );
}

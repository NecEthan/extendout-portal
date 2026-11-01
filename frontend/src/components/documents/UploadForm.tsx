"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useUploadDocument } from "@/hooks/useDocuments";
import { getErrorMessage } from "@/lib/errorMessage";

interface UploadFormProps {
  userRole: UserRole;
}

export function UploadForm({ userRole }: UploadFormProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sensitivity, setSensitivity] = useState<"STANDARD" | "SENSITIVE">(
    "STANDARD",
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadDocument = useUploadDocument();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    uploadDocument.mutate(
      { file, title: title || file.name, sensitivity },
      {
        onSuccess: () => {
          setTitle("");
          setFile(null);
          setSensitivity("STANDARD");
          if (fileRef.current) fileRef.current.value = "";
        },
      },
    );
  }

  const error = getErrorMessage(uploadDocument, "Upload failed");

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
          accept=".pdf,.docx,.txt"
          required
          ref={fileRef}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {userRole === "admin" && (
        <div className="flex flex-col gap-1.5">
          <Label>Sensitivity</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sensitivity === "STANDARD" ? "default" : "outline"}
              size="sm"
              onClick={() => setSensitivity("STANDARD")}
            >
              Standard
            </Button>
            <Button
              type="button"
              variant={sensitivity === "SENSITIVE" ? "default" : "outline"}
              size="sm"
              onClick={() => setSensitivity("SENSITIVE")}
            >
              Sensitive
            </Button>
          </div>
        </div>
      )}

      <Button type="submit" disabled={uploadDocument.isPending || !file}>
        {uploadDocument.isPending && <Loader2 className="size-4 animate-spin" />}
        {uploadDocument.isPending ? "Uploading…" : "Upload document"}
      </Button>
    </form>
  );
}

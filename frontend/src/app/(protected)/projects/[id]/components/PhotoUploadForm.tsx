"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useUploadPhoto } from "@/hooks/usePhotos";
import { getErrorMessage, UPLOAD_RATE_LIMITED } from "@/lib/errorMessage";

const MAX_DESCRIPTION_LENGTH = 500;

export function PhotoUploadForm({ projectId }: { projectId: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadPhoto(projectId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    uploadPhoto.mutate(
      { file, description: description.trim() || undefined },
      {
        onSuccess: () => {
          setFile(null);
          setDescription("");
          if (fileRef.current) fileRef.current.value = "";
        },
      }
    );
  }

  const error = getErrorMessage(uploadPhoto, "Upload failed", {
    429: UPLOAD_RATE_LIMITED,
  });

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <ErrorAlert message={error} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photo-file">Photo</Label>
          <Input
            id="photo-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            ref={fileRef}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photo-description">Description (optional)</Label>
          <Input
            id="photo-description"
            type="text"
            maxLength={MAX_DESCRIPTION_LENGTH}
            placeholder="e.g. Steel beam installed over kitchen opening"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={uploadPhoto.isPending || !file}>
          {uploadPhoto.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload />
          )}
          {uploadPhoto.isPending ? "Uploading…" : "Upload photo"}
        </Button>
      </div>
    </form>
  );
}

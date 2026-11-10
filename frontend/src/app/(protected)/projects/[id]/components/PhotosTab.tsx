"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useDeletePhoto, useProjectPhotos } from "@/hooks/usePhotos";
import { photoFileUrl } from "@/lib/api/photos";
import { getErrorMessage } from "@/lib/errorMessage";
import { formatDate } from "@/lib/format";
import { PhotoLightbox } from "./PhotoLightbox";
import { PhotoUploadForm } from "./PhotoUploadForm";

export function PhotosTab({ projectId }: { projectId: number }) {
  const photos = useProjectPhotos(projectId);
  const deletePhoto = useDeletePhoto(projectId);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const error =
    getErrorMessage(photos, "Failed to load photos") ??
    getErrorMessage(deletePhoto, "Couldn't delete the photo");

  function handleDelete(photoId: string) {
    if (window.confirm("Delete this photo? This can't be undone.")) {
      deletePhoto.mutate(photoId);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PhotoUploadForm projectId={projectId} />
      <ErrorAlert message={error} />

      {photos.data?.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No site photos yet.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.data?.map((photo, i) => (
          <figure
            key={photo.id}
            className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
          >
            <button
              type="button"
              aria-label={`Preview ${photo.description ?? "photo"}`}
              className="cursor-zoom-in"
              onClick={() => setPreviewIndex(i)}
            >
              {/* Served by our API (auth-checked), so not next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoFileUrl(projectId, photo.id)}
                alt={photo.description ?? "Site photo"}
                loading="lazy"
                className="aspect-[4/3] w-full bg-muted object-cover"
              />
            </button>
            <figcaption className="flex flex-col gap-0.5 p-3 wrap-anywhere">
              {photo.description && (
                <span className="text-sm font-medium">{photo.description}</span>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {photo.uploaded_by_name ?? "Former user"} ·{" "}
                  {formatDate(photo.created_at)}
                </span>
                {photo.can_delete && (
                  <button
                    type="button"
                    aria-label={`Delete ${photo.description ?? "photo"}`}
                    title="Delete photo"
                    className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                    disabled={deletePhoto.isPending}
                    onClick={() => handleDelete(photo.id)}
                  >
                    {deletePhoto.isPending &&
                    deletePhoto.variables === photo.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                )}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      {previewIndex !== null && photos.data && (
        <PhotoLightbox
          photos={photos.data}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}

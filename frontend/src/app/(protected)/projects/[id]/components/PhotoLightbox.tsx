"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ProjectPhoto } from "@/interfaces";
import { photoFileUrl } from "@/lib/api/photos";
import { formatDate } from "@/lib/format";

/** Full-screen preview of one photo, with previous/next through the list.
 * Closes on ✕, Esc or a click on the dark backdrop. */
export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: ProjectPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && hasNext) onIndexChange(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, hasPrev, hasNext, onIndexChange, onClose]);

  if (!photo) return null;

  const navButton =
    "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.description ?? "Site photo"}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close preview"
        className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={20} />
      </button>

      {hasPrev && (
        <button
          type="button"
          aria-label="Previous photo"
          className={`${navButton} left-4`}
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index - 1);
          }}
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          aria-label="Next photo"
          className={`${navButton} right-4`}
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index + 1);
          }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Served by our API (auth-checked), so not next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoFileUrl(photo.project_id, photo.id)}
        alt={photo.description ?? "Site photo"}
        className="max-h-[85vh] max-w-[90vw] rounded-md object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <div
        className="flex max-w-3xl flex-col items-center gap-0.5 text-center text-white wrap-anywhere"
        onClick={(e) => e.stopPropagation()}
      >
        {photo.description && (
          <span className="text-sm font-medium">{photo.description}</span>
        )}
        <span className="text-xs text-white/60">
          {photo.uploaded_by_name ?? "Former user"} ·{" "}
          {formatDate(photo.created_at)} · {index + 1} of {photos.length}
        </span>
      </div>
    </div>
  );
}

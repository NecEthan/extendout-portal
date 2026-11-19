"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ProjectPhoto } from "@/interfaces";
import { photoFileUrl } from "@/lib/api/photos";
import { formatDate } from "@/lib/format";

// A horizontal swipe at least this long (px) moves to the next/previous photo.
const SWIPE_DISTANCE = 50;

/** Full-screen preview of one photo, with previous/next through the list
 * (buttons, arrow keys, or swiping on a phone). Closes on ✕, Esc or a click
 * on the dark backdrop. */
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

  // Where the current touch started, to tell a swipe from a tap.
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Mostly sideways, and far enough: a swipe, not a tap or a scroll.
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0 && hasNext) onIndexChange(index + 1);
    if (dx > 0 && hasPrev) onIndexChange(index - 1);
  }

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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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

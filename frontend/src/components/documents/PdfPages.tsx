"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { documentPreviewPageUrl } from "@/lib/api/documents";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
// Pages are never drawn wider than this at 100%, so desktop pages stay a
// readable size instead of filling a wide screen.
const MAX_PAGE_WIDTH = 900;
// Image widths the backend accepts.
const MIN_IMAGE_WIDTH = 200;
const MAX_IMAGE_WIDTH = 2400;
// Ask for image widths in steps, so small resizes don't fetch new images.
const IMAGE_WIDTH_STEP = 200;

/** A PDF's pages as images drawn by the backend, loaded as they're scrolled
 * to. Sharp on high-density screens; zoom 100–300% fetches bigger images. */
export function PdfPages({
  documentId,
  pages,
}: {
  documentId: string;
  pages: { width: number; height: number }[];
}) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setContainerWidth(Math.floor(entry.contentRect.width))
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pageWidth = Math.floor(Math.min(containerWidth, MAX_PAGE_WIDTH) * zoom);
  const pixelRatio = Math.min(
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
    2
  );
  const imageWidth = Math.min(
    MAX_IMAGE_WIDTH,
    Math.max(
      MIN_IMAGE_WIDTH,
      Math.ceil((pageWidth * pixelRatio) / IMAGE_WIDTH_STEP) * IMAGE_WIDTH_STEP
    )
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {pages.length} page{pages.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.5))}
          >
            <Minus />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))}
          >
            <Plus />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="min-w-0 overflow-x-auto rounded-lg bg-muted-foreground/10 p-2 sm:p-4"
      >
        {pageWidth > 0 && (
          <div
            className="mx-auto flex flex-col gap-2 sm:gap-4"
            style={{ width: pageWidth }}
          >
            {pages.map((page, i) => (
              // Served by our API (auth-checked), so not next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={documentPreviewPageUrl(documentId, i + 1, imageWidth)}
                alt={`Page ${i + 1}`}
                loading="lazy"
                className="block rounded-sm bg-white shadow-sm"
                style={{
                  width: pageWidth,
                  height: Math.round((pageWidth * page.height) / page.width),
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

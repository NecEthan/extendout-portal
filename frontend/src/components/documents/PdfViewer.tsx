"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadPdfjs } from "@/lib/documentLibraries";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
// Pages are never drawn wider than this at 100%, so desktop pages stay a
// readable size instead of filling a wide screen.
const MAX_PAGE_WIDTH = 900;
// Phones (iOS especially) refuse to draw canvases above ~16.7 million pixels.
const MAX_CANVAS_PIXELS = 16_000_000;
/** Put on the element the viewer scrolls inside, so pages are drawn as they
 * near its visible area. */
export const SCROLL_ROOT_ATTR = "data-scroll-root";

interface PageSize {
  width: number;
  height: number;
}

/** Shows a PDF in the page with pdf.js, drawn onto canvases. Works the same on
 * every browser, including Android Chrome (which can't show PDFs itself), and
 * never runs scripts inside the PDF. Pages are only drawn when scrolled near,
 * so long documents open quickly. `onError` runs if the file can't be read. */
export function PdfViewer({
  data,
  onError,
}: {
  data: ArrayBuffer;
  onError: () => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;
    // Destroying the loading task also closes the document and its worker.
    let task: PDFDocumentLoadingTask | null = null;

    async function open() {
      try {
        const pdfjs = await loadPdfjs();
        if (cancelled) return;
        // pdf.js takes ownership of the bytes it's given; pass a copy so the
        // cached download stays usable.
        task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
        const doc = await task.promise;
        const pageSizes: PageSize[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const { width, height } = page.getViewport({ scale: 1 });
          pageSizes.push({ width, height });
        }
        if (cancelled) return;
        setSizes(pageSizes);
        setPdf(doc);
      } catch {
        if (!cancelled) onErrorRef.current();
      }
    }

    open();
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [data]);

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

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {pdf
            ? `${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"}`
            : "Opening…"}
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
        {!pdf || pageWidth === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="animate-spin" aria-label="Loading document" />
          </div>
        ) : (
          <div
            className="mx-auto flex flex-col gap-2 sm:gap-4"
            style={{ width: pageWidth }}
          >
            {sizes.map((size, i) => (
              <PdfPage
                key={i}
                pdf={pdf}
                pageNumber={i + 1}
                size={size}
                width={pageWidth}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPage({
  pdf,
  pageNumber,
  size,
  width,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  size: PageSize;
  width: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nearView, setNearView] = useState(false);
  const height = Math.round((width * size.height) / size.width);

  // Draw once the page is within about a screen of being visible.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || nearView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNearView(true);
      },
      // The margin only works when it's measured against the element that
      // scrolls (the preview's body), not the window.
      { root: el.closest(`[${SCROLL_ROOT_ATTR}]`), rootMargin: "1000px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nearView]);

  useEffect(() => {
    if (!nearView) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    async function draw() {
      const page = await pdf.getPage(pageNumber);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const cssScale = width / size.width;
      // Sharp on high-density screens, within the phone canvas size limit.
      const area = width * height;
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(MAX_CANVAS_PIXELS / area)
      );
      const viewport = page.getViewport({ scale: cssScale * pixelRatio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      await task.promise;
    }

    // A cancelled render (zoom changed, page left) rejects; nothing to do.
    draw().catch(() => {});
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [nearView, pdf, pageNumber, size.width, width, height]);

  return (
    <div
      ref={wrapperRef}
      className="overflow-hidden rounded-sm bg-white shadow-sm"
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Page ${pageNumber}`}
        className="block h-full w-full"
      />
    </div>
  );
}

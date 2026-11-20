"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { PdfPages } from "@/components/documents/PdfPages";
import { SheetTables } from "@/components/documents/SheetTables";
import { useDocumentPreview } from "@/hooks/useDocuments";
import type { DocumentPreview as Preview } from "@/interfaces";
import { documentDownloadUrl } from "@/lib/api/documents";
import { getErrorMessage } from "@/lib/errorMessage";

// Word HTML from the backend has no styles of its own (they're stripped).
const WORD_STYLES = [
  "mx-auto max-w-3xl rounded-lg bg-card p-4 text-sm leading-relaxed break-words sm:p-8 sm:text-base",
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1:first-child]:mt-0",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold",
  "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_h4]:mt-3 [&_h4]:font-semibold [&_p]:my-2",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_a]:text-primary [&_a]:underline [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full",
  "[&_table]:my-3 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse",
  "[&_td]:border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_th]:border [&_th]:px-2 [&_th]:py-1",
  "[&_td_p]:my-0 [&_th_p]:my-0",
].join(" ");

/** Pop-up over the Documents tab showing a document's current file: PDF, Word
 * or Excel. The backend parses the file; this only shows the result (page
 * images, cleaned HTML or table rows). Full screen on phones. Closes on ✕,
 * Esc or a click on the dark backdrop. */
export function DocumentPreview({
  documentId,
  title,
  onClose,
}: {
  documentId: string;
  title: string;
  onClose: () => void;
}) {
  const preview = useDocumentPreview(documentId);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    // Keyboard and screen-reader users start inside the pop-up; return
    // focus to where they were when it closes.
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  // 409: no ready version, or a file the backend couldn't read (its message
  // says to download instead).
  const error = getErrorMessage(preview, "Couldn't open this document");

  let body: React.ReactNode;
  if (error) {
    body = <ErrorAlert message={error} />;
  } else if (!preview.data) {
    body = (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" aria-label="Loading document" />
      </div>
    );
  } else {
    body = <PreviewBody documentId={documentId} preview={preview.data} />;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${title}`}
        className="flex w-full max-w-6xl flex-col overflow-hidden bg-background shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate font-semibold" title={title}>
            {title}
          </h2>
          <a
            href={documentDownloadUrl(documentId)}
            download
            aria-label={`Download ${title}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Download />
            <span className="hidden sm:inline">Download</span>
          </a>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" })
            )}
          >
            <X />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-4">
          {body}
        </div>
      </div>
    </div>,
    document.body
  );
}

function PreviewBody({
  documentId,
  preview,
}: {
  documentId: string;
  preview: Preview;
}) {
  if (preview.kind === "pdf") {
    return <PdfPages documentId={documentId} pages={preview.pages ?? []} />;
  }
  if (preview.kind === "xlsx") {
    return <SheetTables sheets={preview.sheets ?? []} />;
  }
  return (
    <div
      className={WORD_STYLES}
      // Cleaned on the server (app/services/previews.py: an allow-list of
      // tags, no scripts/styles/event handlers, safe links and images only).
      dangerouslySetInnerHTML={{ __html: preview.html ?? "" }}
    />
  );
}

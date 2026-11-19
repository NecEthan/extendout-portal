"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { DocxViewer } from "@/components/documents/DocxViewer";
import { PdfViewer, SCROLL_ROOT_ATTR } from "@/components/documents/PdfViewer";
import { XlsxViewer } from "@/components/documents/XlsxViewer";
import { useDocumentFile } from "@/hooks/useDocuments";
import { documentDownloadUrl } from "@/lib/api/documents";
import { getErrorMessage } from "@/lib/errorMessage";

export const PDF = "application/pdf";
export const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const VIEWERS = { [PDF]: PdfViewer, [DOCX]: DocxViewer, [XLSX]: XlsxViewer };

const CANT_SHOW =
  "This file can't be shown here. Download it to open it instead.";

/** Pop-up over the Documents tab showing a document's current file: PDF, Word
 * or Excel. Full screen on phones. Closes on ✕, Esc or a click on the dark
 * backdrop. */
export function DocumentPreview({
  documentId,
  title,
  onClose,
}: {
  documentId: string;
  title: string;
  onClose: () => void;
}) {
  const file = useDocumentFile(documentId);
  const [unreadable, setUnreadable] = useState(false);
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

  const error = getErrorMessage(file, "Couldn't open this document", {
    409: "This document has no version ready to view yet.",
  });
  const Viewer = file.data
    ? VIEWERS[file.data.contentType as keyof typeof VIEWERS]
    : undefined;

  let body: React.ReactNode;
  if (error) {
    body = <ErrorAlert message={error} />;
  } else if (file.isPending) {
    body = (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" aria-label="Loading document" />
      </div>
    );
  } else if (unreadable || !Viewer || !file.data) {
    body = <ErrorAlert message={CANT_SHOW} />;
  } else {
    body = <Viewer data={file.data.data} onError={() => setUnreadable(true)} />;
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
        <div
          {...{ [SCROLL_ROOT_ATTR]: "" }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-4"
        >
          {body}
        </div>
      </div>
    </div>,
    document.body
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadDocxPreview } from "@/lib/documentLibraries";

// Narrower than a Word page (A4/Letter at 96 dpi plus a margin): text flows to
// the screen width instead of showing a page too small to read.
const REFLOW_BELOW_WIDTH = 860;
const SAFE_LINK = /^(https?:|mailto:|tel:|#)/i;

/** Shows a Word (.docx) file in the page with docx-preview. Close to Word's
 * layout but not exact (complex layouts, some fonts). On phones the text flows
 * to the screen width. `onError` runs if the file can't be read. */
export function DocxViewer({
  data,
  onError,
}: {
  data: ArrayBuffer;
  onError: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const [reflow, setReflow] = useState(false);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const body = bodyRef.current;
    const style = styleRef.current;
    if (!body || !style) return;
    let cancelled = false;

    async function draw(body: HTMLDivElement, style: HTMLDivElement) {
      try {
        const { renderAsync } = await loadDocxPreview();
        if (cancelled) return;
        const reflow = body.clientWidth < REFLOW_BELOW_WIDTH;
        setReflow(reflow);
        await renderAsync(data, body, style, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: reflow,
          ignoreHeight: reflow,
          breakPages: !reflow,
          ignoreLastRenderedPageBreak: true,
          // Embedded HTML (altChunks) would be shown in an iframe; never.
          renderAltChunks: false,
          renderComments: false,
          renderChanges: false,
        });
        if (cancelled) return;
        makeLinksSafe(body);
        setReady(true);
      } catch {
        if (!cancelled) onErrorRef.current();
      }
    }

    draw(body, style);
    return () => {
      cancelled = true;
      body.replaceChildren();
      style.replaceChildren();
    };
  }, [data]);

  return (
    <div className="relative min-w-0">
      {!ready && (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="animate-spin" aria-label="Loading document" />
        </div>
      )}
      <div ref={styleRef} />
      <div
        ref={bodyRef}
        data-testid="docx-body"
        className={cn(
          "overflow-x-auto rounded-lg [&_.docx-wrapper]:bg-muted-foreground/10 [&_.docx-wrapper]:p-2 sm:[&_.docx-wrapper]:p-4 [&_section.docx]:mb-4 [&_section.docx]:max-w-full",
          // The file's page margins (often an inch) would squeeze the text
          // on a phone; docx-preview sets them inline, hence the !important.
          reflow && "[&_section.docx]:px-4! [&_section.docx]:py-6!"
        )}
      />
    </div>
  );
}

/** Links come from the file, so only web, email and phone links (and links
 * within the document) are kept; anything else (e.g. `javascript:`) is
 * removed. Web links open in a new tab. */
export function makeLinksSafe(root: HTMLElement) {
  root.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (!SAFE_LINK.test(href.trim())) {
      a.removeAttribute("href");
      return;
    }
    if (!href.startsWith("#")) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  });
}

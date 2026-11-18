import { INPUT_LIMITS } from "@/lib/inputLimits";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Default document title from a file name: "kitchen-quote.pdf" → "kitchen-quote".
 * Keeps the full name if stripping the extension would leave nothing (".pdf"). */
export function titleFromFilename(filename: string): string {
  const title = filename.replace(/\.[^.]+$/, "").trim() || filename;
  // Very long file names are cut to the backend's title limit.
  return title.slice(0, INPUT_LIMITS.documentTitle).trim();
}

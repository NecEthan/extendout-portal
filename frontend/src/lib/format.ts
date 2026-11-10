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
  return filename.replace(/\.[^.]+$/, "").trim() || filename;
}

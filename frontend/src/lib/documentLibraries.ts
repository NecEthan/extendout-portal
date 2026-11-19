// The libraries that draw document previews. Each is loaded on demand, so
// they only download when someone previews that kind of file. In their own
// module so Jest tests can replace them (jest.mock("@/lib/documentLibraries")).

/** pdf.js (~1 MB). The legacy build supports older phone browsers (e.g. iOS
 * before 17.4). */
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  return pdfjs;
}

/** docx-preview: draws a Word file as HTML pages. */
export async function loadDocxPreview() {
  return import("docx-preview");
}

/** SheetJS: reads Excel files. Installed from cdn.sheetjs.com, not npm: the
 * npm package stopped at 0.18.5, which has known security issues. */
export async function loadSheetJs() {
  return import("xlsx");
}

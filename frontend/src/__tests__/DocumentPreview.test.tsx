import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  DOCX,
  DocumentPreview,
  PDF,
  XLSX,
} from "@/components/documents/DocumentPreview";
import { lastRequest, respond } from "@/test-utils/mockApi";

jest.mock("@/lib/documentLibraries", () => ({}));
// Each viewer has its own tests; here they only report what they were given.
jest.mock("@/components/documents/PdfViewer", () => ({
  SCROLL_ROOT_ATTR: "data-scroll-root",
  PdfViewer: () => <p>pdf viewer</p>,
}));
jest.mock("@/components/documents/DocxViewer", () => ({
  DocxViewer: ({ onError }: { onError: () => void }) => (
    <button onClick={onError}>word viewer</button>
  ),
}));
jest.mock("@/components/documents/XlsxViewer", () => ({
  XlsxViewer: () => <p>excel viewer</p>,
}));

function renderPreview(onClose = jest.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentPreview documentId="doc-1" title="Quote" onClose={onClose} />
    </QueryClientProvider>
  );
  return onClose;
}

describe("DocumentPreview", () => {
  it.each([
    [PDF, "pdf viewer"],
    [DOCX, "word viewer"],
    [XLSX, "excel viewer"],
  ])("shows a %s file in its viewer", async (contentType, viewer) => {
    respond(200, new ArrayBuffer(4), { "content-type": contentType });
    renderPreview();

    expect(await screen.findByText(viewer)).toBeInTheDocument();
    expect(lastRequest().url).toBe("/documents/doc-1/download");
    expect(lastRequest().responseType).toBe("arraybuffer");
  });

  it("asks to download a file it can't read", async () => {
    respond(200, new ArrayBuffer(4), { "content-type": DOCX });
    renderPreview();

    fireEvent.click(await screen.findByText("word viewer"));
    expect(
      screen.getByText(/can't be shown here. Download it/)
    ).toBeInTheDocument();
  });

  it("explains when no version is ready", async () => {
    respond(409, { detail: "This document has no version ready" });
    renderPreview();

    expect(
      await screen.findByText("This document has no version ready to view yet.")
    ).toBeInTheDocument();
  });

  it("closes on the close button and on Esc", async () => {
    respond(200, new ArrayBuffer(4), { "content-type": PDF });
    const onClose = renderPreview();

    const dialog = screen.getByRole("dialog", { name: "Preview of Quote" });
    expect(screen.getByRole("link", { name: "Download Quote" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    // Clicks inside the pop-up don't close it.
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
    await screen.findByText("pdf viewer");
  });
});

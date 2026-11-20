import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import type { DocumentPreview as Preview } from "@/interfaces";
import { api } from "@/lib/api/axiosClient";
import { lastRequest, respond } from "@/test-utils/mockApi";

// jsdom has no layout: report a 400px-wide container.
beforeAll(() => {
  global.ResizeObserver = class {
    constructor(private cb: ResizeObserverCallback) {}
    observe() {
      this.cb(
        [{ contentRect: { width: 400 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver
      );
    }
    disconnect() {}
    unobserve() {}
  };
});

function preview(fields: Partial<Preview>): Preview {
  return { kind: "pdf", pages: null, html: null, sheets: null, ...fields };
}

function renderPreview(onClose = jest.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentPreview documentId="doc-1" title="Quote" onClose={onClose} />
    </QueryClientProvider>
  );
  return onClose;
}

describe("DocumentPreview", () => {
  it("shows PDF pages as images from the backend, sized to the screen", async () => {
    respond(
      200,
      preview({
        kind: "pdf",
        pages: [
          { width: 600, height: 800 },
          { width: 800, height: 600 },
        ],
      })
    );
    renderPreview();

    expect(await screen.findByText("2 pages")).toBeInTheDocument();
    expect(lastRequest().url).toBe("/documents/doc-1/preview");
    const [first, second] = screen.getAllByRole("img", { name: /^Page \d$/ });
    expect(first).toHaveAttribute(
      "src",
      `${api.defaults.baseURL}/documents/doc-1/preview/pages/1?width=400`
    );
    expect(first).toHaveAttribute("loading", "lazy");
    // 400px wide: portrait 400×533, landscape 400×300.
    expect(first).toHaveStyle({ width: "400px", height: "533px" });
    expect(second).toHaveStyle({ width: "400px", height: "300px" });
  });

  it("zooms PDF pages between 100% and 300%, fetching bigger images", async () => {
    respond(
      200,
      preview({ kind: "pdf", pages: [{ width: 600, height: 800 }] })
    );
    renderPreview();
    await screen.findByText("1 page");

    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    fireEvent.click(zoomIn);
    expect(screen.getByText("150%")).toBeInTheDocument();
    const page = screen.getByRole("img", { name: "Page 1" });
    expect(page).toHaveStyle({ width: "600px" });
    expect(page.getAttribute("src")).toMatch(/width=600$/);
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    expect(screen.getByText("300%")).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
  });

  it("shows Word documents as the HTML the backend cleaned", async () => {
    respond(
      200,
      preview({ kind: "docx", html: "<h1>Loft spec</h1><p>Beams.</p>" })
    );
    renderPreview();

    expect(
      await screen.findByRole("heading", { name: "Loft spec" })
    ).toBeInTheDocument();
    expect(screen.getByText("Beams.")).toBeInTheDocument();
  });

  it("shows Excel sheets as tables", async () => {
    respond(
      200,
      preview({
        kind: "xlsx",
        sheets: [
          {
            name: "Quote",
            rows: [
              [
                { text: "Beam", numeric: false },
                { text: "£1,200.00", numeric: true },
              ],
            ],
            cut_rows: false,
            cut_columns: false,
          },
        ],
      })
    );
    renderPreview();

    const table = await screen.findByRole("table", { name: "Quote" });
    expect(within(table).getByText("£1,200.00")).toBeInTheDocument();
  });

  it("shows the backend's message when the file can't be previewed", async () => {
    respond(409, {
      detail: "This file can't be previewed. Download it to open it instead.",
    });
    renderPreview();

    expect(
      await screen.findByText(/can't be previewed. Download it/)
    ).toBeInTheDocument();
  });

  it("closes on the close button and on Esc, not on clicks inside", async () => {
    respond(200, preview({ kind: "docx", html: "<p>Hi</p>" }));
    const onClose = renderPreview();

    const dialog = screen.getByRole("dialog", { name: "Preview of Quote" });
    expect(screen.getByRole("link", { name: "Download Quote" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
    await screen.findByText("Hi");
  });
});

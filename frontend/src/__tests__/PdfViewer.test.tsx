import { act, render, screen, waitFor } from "@testing-library/react";
import { PdfViewer } from "@/components/documents/PdfViewer";

const renderPage = jest.fn(() => ({
  promise: Promise.resolve(),
  cancel: jest.fn(),
}));
const destroy = jest.fn();
let openResult: Promise<unknown>;

function fakePdf(numPages: number) {
  return {
    numPages,
    getPage: jest.fn(async () => ({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
      }),
      render: renderPage,
    })),
  };
}

jest.mock("@/lib/documentLibraries", () => ({
  loadPdfjs: async () => ({
    getDocument: () => ({ promise: openResult, destroy }),
  }),
}));

// jsdom has no layout: report a 400px-wide container and every page in view.
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
  global.IntersectionObserver = class {
    constructor(private cb: IntersectionObserverCallback) {}
    observe() {
      this.cb(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      );
    }
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
  HTMLCanvasElement.prototype.getContext = jest.fn();
});

beforeEach(() => jest.clearAllMocks());

describe("PdfViewer", () => {
  it("shows every page, sized to the screen width", async () => {
    openResult = Promise.resolve(fakePdf(3));
    render(<PdfViewer data={new ArrayBuffer(8)} onError={jest.fn()} />);

    expect(await screen.findByText("3 pages")).toBeInTheDocument();
    const pages = screen.getAllByRole("img", { name: /^Page \d$/ });
    expect(pages).toHaveLength(3);
    // 400px wide container, A4-ish 600×800 page → 400×533.
    expect(pages[0].parentElement).toHaveStyle({
      width: "400px",
      height: "533px",
    });
    await waitFor(() => expect(renderPage).toHaveBeenCalledTimes(3));
  });

  it("zooms in and out between 100% and 300%", async () => {
    openResult = Promise.resolve(fakePdf(1));
    render(<PdfViewer data={new ArrayBuffer(8)} onError={jest.fn()} />);
    await screen.findByText("1 page");

    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    const zoomOut = screen.getByRole("button", { name: "Zoom out" });
    expect(zoomOut).toBeDisabled();

    act(() => zoomIn.click());
    expect(screen.getByText("150%")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Page 1" }).parentElement
    ).toHaveStyle({
      width: "600px",
    });
    act(() => zoomIn.click());
    act(() => zoomIn.click());
    act(() => zoomIn.click());
    expect(screen.getByText("300%")).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
  });

  it("calls onError when the file isn't a readable PDF", async () => {
    openResult = Promise.reject(new Error("Invalid PDF structure"));
    const onError = jest.fn();
    render(<PdfViewer data={new ArrayBuffer(8)} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalled());
  });

  it("closes the document when the viewer goes away", async () => {
    openResult = Promise.resolve(fakePdf(1));
    const { unmount } = render(
      <PdfViewer data={new ArrayBuffer(8)} onError={jest.fn()} />
    );
    await screen.findByText("1 page");
    unmount();
    expect(destroy).toHaveBeenCalled();
  });
});

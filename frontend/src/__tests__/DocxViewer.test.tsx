import { render, screen, waitFor } from "@testing-library/react";
import { DocxViewer, makeLinksSafe } from "@/components/documents/DocxViewer";

const renderAsync = jest.fn();

jest.mock("@/lib/documentLibraries", () => ({
  loadDocxPreview: async () => ({ renderAsync }),
}));

beforeEach(() => renderAsync.mockReset());

describe("DocxViewer", () => {
  it("draws the document without embedded HTML or comments", async () => {
    renderAsync.mockImplementation(async (_data, body: HTMLElement) => {
      body.innerHTML =
        '<section class="docx"><p>Loft spec</p><a href="javascript:alert(1)">bad</a></section>';
    });
    const data = new ArrayBuffer(4);
    render(<DocxViewer data={data} onError={jest.fn()} />);

    expect(await screen.findByText("Loft spec")).toBeInTheDocument();
    expect(screen.getByText("bad")).not.toHaveAttribute("href");
    expect(screen.queryByLabelText("Loading document")).toBeNull();
    const [passed, , , options] = renderAsync.mock.calls[0];
    expect(passed).toBe(data);
    expect(options).toMatchObject({
      renderAltChunks: false,
      renderComments: false,
      renderChanges: false,
    });
  });

  it("calls onError when the file can't be read", async () => {
    renderAsync.mockRejectedValue(new Error("Corrupted zip"));
    const onError = jest.fn();
    render(<DocxViewer data={new ArrayBuffer(4)} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});

describe("makeLinksSafe", () => {
  it("keeps web, email, phone and in-document links only", () => {
    const root = document.createElement("div");
    root.innerHTML = [
      '<a href="https://example.com">web</a>',
      '<a href="mailto:a@b.com">mail</a>',
      '<a href="tel:0123">phone</a>',
      '<a href="#section-2">jump</a>',
      '<a href=" JavaScript:alert(1)">script</a>',
      '<a href="data:text/html,hi">data</a>',
      '<a href="file:///C:/x">file</a>',
    ].join("");
    makeLinksSafe(root);

    const href = (text: string) =>
      [...root.querySelectorAll("a")]
        .find((a) => a.textContent === text)
        ?.getAttribute("href");
    expect(href("web")).toBe("https://example.com");
    expect(href("mail")).toBe("mailto:a@b.com");
    expect(href("phone")).toBe("tel:0123");
    expect(href("jump")).toBe("#section-2");
    expect(href("script")).toBeNull();
    expect(href("data")).toBeNull();
    expect(href("file")).toBeNull();

    const web = [...root.querySelectorAll("a")][0];
    expect(web.target).toBe("_blank");
    expect(web.rel).toBe("noopener noreferrer");
  });
});

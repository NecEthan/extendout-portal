import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import * as XLSX from "xlsx";
import {
  MAX_COLUMNS,
  MAX_ROWS,
  XlsxViewer,
  columnLetters,
} from "@/components/documents/XlsxViewer";

// The real SheetJS works in Jest; only the dynamic import is replaced.
jest.mock("@/lib/documentLibraries", () => ({
  loadSheetJs: async () => jest.requireActual("xlsx"),
}));

function workbook(
  sheets: Record<string, unknown[][]>,
  hidden: string[] = []
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  wb.Workbook = {
    Sheets: wb.SheetNames.map((name) => ({
      name,
      Hidden: hidden.includes(name) ? 1 : 0,
    })),
  };
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

describe("XlsxViewer", () => {
  it("shows the first sheet as a table with Excel's labels", async () => {
    const data = workbook({
      Quote: [
        ["Item", "Cost"],
        ["Steel beam", 1200],
      ],
    });
    render(<XlsxViewer data={data} onError={jest.fn()} />);

    const table = await screen.findByRole("table", { name: "Quote" });
    expect(within(table).getByText("A")).toBeInTheDocument();
    expect(within(table).getByText("B")).toBeInTheDocument();
    expect(within(table).getByText("Steel beam")).toBeInTheDocument();
    const cost = within(table).getByText("1200");
    expect(cost).toHaveClass("text-right");
    // No tabs for a single sheet.
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("switches between visible sheets, skipping hidden ones", async () => {
    const data = workbook(
      { Summary: [["Total"]], Workings: [["Hidden calc"]], Labour: [["Days"]] },
      ["Workings"]
    );
    render(<XlsxViewer data={data} onError={jest.fn()} />);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Summary", "Labour"]);
    expect(screen.getByText("Total")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Labour" }));
    expect(screen.getByText("Days")).toBeInTheDocument();
    expect(screen.queryByText("Total")).toBeNull();
  });

  it("only shows the first rows and columns of a huge sheet", async () => {
    const wide = Array.from({ length: MAX_COLUMNS + 5 }, (_, i) => i);
    const rows = Array.from({ length: MAX_ROWS + 10 }, () => wide);
    render(<XlsxViewer data={workbook({ Big: rows })} onError={jest.fn()} />);

    expect(
      await screen.findByText(
        /Showing the first 1,000 rows and 50 columns/,
        {},
        { timeout: 5000 }
      )
    ).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Big" });
    expect(within(table).getAllByRole("row")).toHaveLength(MAX_ROWS + 1);
  });

  it("calls onError when the file isn't a spreadsheet", async () => {
    const onError = jest.fn();
    // A zip header with nothing after it.
    const junk = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]).buffer;
    render(<XlsxViewer data={junk} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalled());
  });

  it("labels columns like Excel", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnLetters)).toEqual([
      "A",
      "Z",
      "AA",
      "AB",
      "ZZ",
      "AAA",
    ]);
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { SheetTables, columnLetters } from "@/components/documents/SheetTables";
import type { PreviewSheet } from "@/interfaces";

function sheet(name: string, texts: string[][], cut = false): PreviewSheet {
  return {
    name,
    rows: texts.map((row) =>
      row.map((text) => ({ text, numeric: /^[£\d]/.test(text) }))
    ),
    cut_rows: cut,
    cut_columns: false,
  };
}

describe("SheetTables", () => {
  it("shows a sheet with Excel's labels, numbers on the right", () => {
    render(
      <SheetTables
        sheets={[
          sheet("Quote", [
            ["Item", "Cost"],
            ["Beam", "£1,200.00"],
          ]),
        ]}
      />
    );

    const table = screen.getByRole("table", { name: "Quote" });
    expect(within(table).getByText("A")).toBeInTheDocument();
    expect(within(table).getByText("B")).toBeInTheDocument();
    expect(within(table).getByText("2")).toBeInTheDocument();
    expect(within(table).getByText("£1,200.00")).toHaveClass("text-right");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("switches between sheets", () => {
    render(
      <SheetTables
        sheets={[sheet("Summary", [["Total"]]), sheet("Labour", [["Days"]])]}
      />
    );

    expect(screen.getByText("Total")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Labour" }));
    expect(screen.getByText("Days")).toBeInTheDocument();
    expect(screen.queryByText("Total")).toBeNull();
  });

  it("says when a sheet is cut short or empty", () => {
    render(
      <SheetTables sheets={[sheet("Big", [["1"]], true), sheet("Blank", [])]} />
    );
    expect(screen.getByText(/too big to show in full/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Blank" }));
    expect(screen.getByText("This sheet is empty.")).toBeInTheDocument();
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

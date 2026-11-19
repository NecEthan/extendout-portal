"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadSheetJs } from "@/lib/documentLibraries";

// Big sheets would make the page slow to draw; the rest is in the download.
export const MAX_ROWS = 1000;
export const MAX_COLUMNS = 50;

interface Cell {
  text: string;
  numeric: boolean;
}

interface Sheet {
  name: string;
  /** First row/column numbers shown (0-based), for Excel-style labels. */
  firstRow: number;
  firstColumn: number;
  rows: Cell[][];
  totalRows: number;
  totalColumns: number;
}

/** Shows an Excel (.xlsx) file as tables, one tab per visible sheet, with
 * Excel's column letters and row numbers. Values are shown as Excel formats
 * them (e.g. "£1,200.00"); formulas show their last saved result. `onError`
 * runs if the file can't be read. */
export function XlsxViewer({
  data,
  onError,
}: {
  data: ArrayBuffer;
  onError: () => void;
}) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [active, setActive] = useState(0);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;

    async function open() {
      try {
        const XLSX = await loadSheetJs();
        const workbook = XLSX.read(new Uint8Array(data), {
          type: "array",
          // Only read what's shown: keeps huge sheets fast.
          sheetRows: MAX_ROWS,
        });
        const hidden = new Set(
          (workbook.Workbook?.Sheets ?? [])
            .filter((s) => s.Hidden)
            .map((s) => s.name)
        );
        const result: Sheet[] = workbook.SheetNames.filter(
          (name) => !hidden.has(name)
        ).map((name) => {
          const ws = workbook.Sheets[name];
          const ref = ws["!ref"];
          if (!ref) {
            return {
              name,
              firstRow: 0,
              firstColumn: 0,
              rows: [],
              totalRows: 0,
              totalColumns: 0,
            };
          }
          const shown = XLSX.utils.decode_range(ref);
          const full = XLSX.utils.decode_range(ws["!fullref"] ?? ref);
          const lastColumn = Math.min(shown.e.c, shown.s.c + MAX_COLUMNS - 1);
          const rows: Cell[][] = [];
          for (let r = shown.s.r; r <= shown.e.r; r++) {
            const row: Cell[] = [];
            for (let c = shown.s.c; c <= lastColumn; c++) {
              const cell = ws[XLSX.utils.encode_cell({ r, c })];
              row.push({
                text: cell ? (cell.w ?? String(cell.v ?? "")) : "",
                numeric: cell?.t === "n",
              });
            }
            rows.push(row);
          }
          return {
            name,
            firstRow: shown.s.r,
            firstColumn: shown.s.c,
            rows,
            totalRows: full.e.r - full.s.r + 1,
            totalColumns: full.e.c - full.s.c + 1,
          };
        });
        if (cancelled) return;
        setSheets(result);
        setActive(0);
      } catch {
        if (!cancelled) onErrorRef.current();
      }
    }

    open();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!sheets) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" aria-label="Loading spreadsheet" />
      </div>
    );
  }

  const sheet = sheets[active];
  if (!sheet) {
    return (
      <p className="text-sm text-muted-foreground">
        This spreadsheet has no sheets to show.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {sheets.length > 1 && (
        <div
          role="tablist"
          aria-label="Sheets"
          className="flex gap-1 overflow-x-auto pb-1"
        >
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "shrink-0 rounded-md border px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                i === active
                  ? "border-primary bg-primary font-medium text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <SheetTable sheet={sheet} />
    </div>
  );
}

function SheetTable({ sheet }: { sheet: Sheet }) {
  if (sheet.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">This sheet is empty.</p>
    );
  }

  const columns = sheet.rows[0].length;
  const cutRows = sheet.totalRows > sheet.rows.length;
  const cutColumns = sheet.totalColumns > columns;
  const header =
    "sticky top-0 z-10 border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground";

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {(cutRows || cutColumns) && (
        <p className="text-sm text-muted-foreground">
          Showing the first{" "}
          {[
            cutRows && `${sheet.rows.length.toLocaleString()} rows`,
            cutColumns && `${columns} columns`,
          ]
            .filter(Boolean)
            .join(" and ")}
          . Download the file to see everything.
        </p>
      )}
      <div className="max-h-[calc(100dvh-11rem)] overflow-auto rounded-lg border">
        <table
          aria-label={sheet.name}
          className="border-collapse bg-card text-sm"
        >
          <thead>
            <tr>
              <th className={header} />
              {Array.from({ length: columns }, (_, i) => (
                <th key={i} scope="col" className={header}>
                  {columnLetters(sheet.firstColumn + i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, r) => (
              <tr key={r}>
                <th
                  scope="row"
                  className="border bg-muted px-2 py-1 text-right text-xs font-medium text-muted-foreground"
                >
                  {sheet.firstRow + r + 1}
                </th>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={cn(
                      "max-w-[20rem] border px-2 py-1 align-top break-words whitespace-pre-wrap",
                      cell.numeric && "text-right tabular-nums"
                    )}
                  >
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 0 → A, 25 → Z, 26 → AA, as Excel labels columns. */
export function columnLetters(index: number): string {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}

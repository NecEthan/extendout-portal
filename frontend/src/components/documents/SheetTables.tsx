"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PreviewSheet } from "@/interfaces";

/** An Excel file's sheets (read by the backend) as tables, one tab per sheet,
 * with Excel's column letters and row numbers. */
export function SheetTables({ sheets }: { sheets: PreviewSheet[] }) {
  const [active, setActive] = useState(0);
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

function SheetTable({ sheet }: { sheet: PreviewSheet }) {
  if (sheet.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">This sheet is empty.</p>
    );
  }

  const columns = sheet.rows[0].length;
  const header =
    "sticky top-0 z-10 border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground";

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {(sheet.cut_rows || sheet.cut_columns) && (
        <p className="text-sm text-muted-foreground">
          This sheet is too big to show in full. Download the file to see
          everything.
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
                  {columnLetters(i)}
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
                  {r + 1}
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

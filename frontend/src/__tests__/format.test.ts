import { titleFromFilename } from "@/lib/format";

describe("titleFromFilename", () => {
  it("strips the extension", () => {
    expect(titleFromFilename("kitchen-quote.pdf")).toBe("kitchen-quote");
    expect(titleFromFilename("Costs.xlsx")).toBe("Costs");
  });

  it("only strips the last extension", () => {
    expect(titleFromFilename("plans.v2.docx")).toBe("plans.v2");
  });

  it("keeps names without an extension", () => {
    expect(titleFromFilename("README")).toBe("README");
  });

  it("falls back to the full name when only an extension is left", () => {
    expect(titleFromFilename(".pdf")).toBe(".pdf");
  });
});

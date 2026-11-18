import { titleFromFilename } from "@/lib/format";
import { INPUT_LIMITS } from "@/lib/inputLimits";

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

  it("cuts very long names to the backend's title limit", () => {
    const title = titleFromFilename(`${"a".repeat(300)}.pdf`);
    expect(title).toBe("a".repeat(INPUT_LIMITS.documentTitle));
  });
});

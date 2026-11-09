import { ApiError } from "@/lib/api/client";
import {
  deleteDocument,
  listDocuments,
  uploadDocument,
} from "@/lib/api/documents";
import { lastRequest, respond } from "@/test-utils/mockApi";

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("uploadDocument", () => {
  it("sends POST with FormData containing file, title and project", async () => {
    respond(202, { id: "uuid-1", status: "accepted" });

    const file = new File(["hello"], "test.docx", { type: DOCX });
    const result = await uploadDocument(file, "My Doc", 101);

    expect(result).toEqual({ id: "uuid-1", status: "accepted" });
    const req = lastRequest();
    expect(req.url).toBe("/documents");
    expect(req.method).toBe("post");
    expect(req.withCredentials).toBe(true);
    expect(req.data).toBeInstanceOf(FormData);
    const form = req.data as FormData;
    expect((form.get("file") as File).name).toBe("test.docx");
    expect(form.get("title")).toBe("My Doc");
    expect(form.get("project_id")).toBe("101");
  });

  it("throws ApiError with backend detail on failure", async () => {
    respond(413, { detail: "File exceeds 50 MB limit" });

    const file = new File(["x"], "big.pdf");
    await expect(uploadDocument(file, "title", 101)).rejects.toMatchObject({
      status: 413,
      message: "File exceeds 50 MB limit",
    });
  });

  it("throws ApiError instance on failure", async () => {
    respond(415, { detail: "Unsupported file type" });

    await expect(
      uploadDocument(new File([""], "f.exe"), "t", 101)
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("deleteDocument", () => {
  it("sends DELETE request to correct URL", async () => {
    respond(204);

    await deleteDocument("doc-abc");

    const req = lastRequest();
    expect(req.url).toBe("/documents/doc-abc");
    expect(req.method).toBe("delete");
    expect(req.withCredentials).toBe(true);
  });

  it("throws ApiError on failure", async () => {
    respond(404, { detail: "Document not found" });

    await expect(deleteDocument("missing")).rejects.toMatchObject({
      status: 404,
      message: "Document not found",
    });
  });
});

describe("listDocuments", () => {
  it("calls GET /documents with limit/offset query params", async () => {
    const page = { items: [], total: 0, limit: 20, offset: 0 };
    respond(200, page);

    await expect(listDocuments(20, 0)).resolves.toEqual(page);
    const req = lastRequest();
    expect(req.url).toBe("/documents");
    expect(req.params).toEqual({ limit: 20, offset: 0, project_id: undefined });
  });

  it("adds project_id when given", async () => {
    respond(200, { items: [], total: 0, limit: 20, offset: 0 });

    await listDocuments(20, 40, 7);
    expect(lastRequest().params).toEqual({
      limit: 20,
      offset: 40,
      project_id: 7,
    });
  });
});

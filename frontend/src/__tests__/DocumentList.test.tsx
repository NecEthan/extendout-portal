import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { DocumentList } from "@/app/(protected)/projects/[id]/components/DocumentList";
import type { Document } from "@/interfaces";
import { api } from "@/lib/api/axiosClient";
import "@/test-utils/mockApi";

function doc(id: string, title: string, hasActive: boolean): Document {
  return {
    id,
    title,
    owner_id: "u1",
    source_type: "upload",
    project_id: 7,
    created_at: "2026-11-10T09:00:00Z",
    latest_version_status: hasActive ? "ACTIVE" : "PROCESSING",
    has_active_version: hasActive,
  };
}

function renderList(documents: Document[]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentList documents={documents} />
    </QueryClientProvider>
  );
}

describe("DocumentList download", () => {
  it("links to the download endpoint for documents with a ready version", () => {
    renderList([doc("doc-1", "Loft plan", true)]);

    const link = screen.getByRole("link", { name: "Download Loft plan" });
    expect(link).toHaveAttribute(
      "href",
      `${api.defaults.baseURL}/documents/doc-1/download`
    );
    expect(link).toHaveAttribute("download");
  });

  it("hides download until a version is ready", () => {
    renderList([doc("doc-2", "Still processing", false)]);

    expect(
      screen.queryByRole("link", { name: "Download Still processing" })
    ).toBeNull();
  });
});

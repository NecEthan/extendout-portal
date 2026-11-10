import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhotosTab } from "@/app/(protected)/projects/[id]/components/PhotosTab";
import type { ProjectPhoto } from "@/interfaces";
import { lastRequest, respond } from "@/test-utils/mockApi";

function photo(
  id: string,
  description: string,
  canDelete: boolean
): ProjectPhoto {
  return {
    id,
    project_id: 7,
    description,
    content_type: "image/jpeg",
    uploaded_by_name: "Sam",
    created_at: "2026-11-10T09:00:00Z",
    can_delete: canDelete,
  };
}

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PhotosTab projectId={7} />
    </QueryClientProvider>
  );
}

describe("PhotosTab delete", () => {
  beforeEach(() => {
    respond(200, [
      photo("mine", "My beam", true),
      photo("theirs", "Their roof", false),
    ]);
  });

  it("only shows delete on photos the user may delete", async () => {
    renderTab();
    await screen.findByRole("img", { name: "My beam" });

    expect(
      screen.getByRole("button", { name: "Delete My beam" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete Their roof" })
    ).toBeNull();
  });

  it("asks for confirmation and does nothing if cancelled", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    renderTab();
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete My beam" })
    );

    expect(confirm).toHaveBeenCalled();
    expect(lastRequest().method).toBe("get"); // no DELETE sent
    confirm.mockRestore();
  });

  it("deletes after confirmation", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    renderTab();
    const button = await screen.findByRole("button", {
      name: "Delete My beam",
    });

    respond(204); // the DELETE
    respond(200, [photo("theirs", "Their roof", false)]); // the refetch
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.queryByRole("img", { name: "My beam" })).toBeNull()
    );
    confirm.mockRestore();
  });
});

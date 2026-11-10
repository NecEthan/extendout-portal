import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoLightbox } from "@/app/(protected)/projects/[id]/components/PhotoLightbox";
import type { ProjectPhoto } from "@/interfaces";

const photos: ProjectPhoto[] = ["Beam in", "Roof on", "Plastered"].map(
  (description, i) => ({
    id: `p-${i}`,
    project_id: 7,
    description,
    content_type: "image/jpeg",
    uploaded_by_name: "Sam",
    created_at: "2026-11-10T09:00:00Z",
    can_delete: false,
  })
);

function renderAt(index: number) {
  const onClose = jest.fn();
  const onIndexChange = jest.fn();
  render(
    <PhotoLightbox
      photos={photos}
      index={index}
      onIndexChange={onIndexChange}
      onClose={onClose}
    />
  );
  return { onClose, onIndexChange };
}

describe("PhotoLightbox", () => {
  it("shows the photo large with its description and position", () => {
    renderAt(1);
    const img = screen.getByRole("img", { name: "Roof on" });
    expect(img).toHaveAttribute(
      "src",
      "http://localhost:8000/projects/7/photos/p-1/file"
    );
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
  });

  it("closes on Escape, the close button and a backdrop click", () => {
    const { onClose } = renderAt(1);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close when the image itself is clicked", () => {
    const { onClose } = renderAt(1);
    fireEvent.click(screen.getByRole("img"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("moves with arrow keys and buttons", () => {
    const { onIndexChange } = renderAt(1);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(onIndexChange.mock.calls).toEqual([[2], [0], [2]]);
  });

  it("hides previous on the first photo and next on the last", () => {
    renderAt(0);
    expect(screen.queryByRole("button", { name: "Previous photo" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Next photo" })
    ).toBeInTheDocument();
  });
});

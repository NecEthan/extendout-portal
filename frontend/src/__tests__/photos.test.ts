import {
  deleteProjectPhoto,
  listProjectPhotos,
  photoFileUrl,
  uploadProjectPhoto,
} from "@/lib/api/photos";
import { lastRequest, respond } from "@/test-utils/mockApi";

const photo = {
  id: "p-1",
  project_id: 7,
  description: "Beam in",
  content_type: "image/jpeg",
  uploaded_by_name: "Sam",
  created_at: "2026-11-10T09:00:00Z",
  can_delete: true,
};

describe("photos API", () => {
  it("lists a project's photos", async () => {
    respond(200, [photo]);
    await expect(listProjectPhotos(7)).resolves.toEqual([photo]);
    expect(lastRequest().url).toBe("/projects/7/photos");
  });

  it("uploads the file and description as a form", async () => {
    respond(201, photo);
    const file = new File(["x"], "site.jpg", { type: "image/jpeg" });

    await expect(uploadProjectPhoto(7, file, "Beam in")).resolves.toEqual(
      photo
    );
    const req = lastRequest();
    expect(req.url).toBe("/projects/7/photos");
    expect(req.method).toBe("post");
    const form = req.data as FormData;
    expect((form.get("file") as File).name).toBe("site.jpg");
    expect(form.get("description")).toBe("Beam in");
  });

  it("leaves description out when not given", async () => {
    respond(201, { ...photo, description: null });
    await uploadProjectPhoto(7, new File(["x"], "site.jpg"));
    expect((lastRequest().data as FormData).has("description")).toBe(false);
  });

  it("builds the image URL from the API base URL", () => {
    expect(photoFileUrl(7, "p-1")).toBe(
      "http://localhost:8000/projects/7/photos/p-1/file"
    );
  });

  it("deletes a photo", async () => {
    respond(204);
    await deleteProjectPhoto(7, "p-1");
    const req = lastRequest();
    expect(req.method).toBe("delete");
    expect(req.url).toBe("/projects/7/photos/p-1");
  });
});

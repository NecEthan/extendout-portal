import type { ProjectPhoto } from "@/interfaces";
import { apiRoutes } from "./apiRoutes";
import { api } from "./axiosClient";

export async function listProjectPhotos(
  projectId: number
): Promise<ProjectPhoto[]> {
  const { data } = await api.get<ProjectPhoto[]>(
    apiRoutes.projectPhotos(projectId)
  );
  return data;
}

export async function uploadProjectPhoto(
  projectId: number,
  file: File,
  description?: string
): Promise<ProjectPhoto> {
  const form = new FormData();
  form.append("file", file);
  if (description) form.append("description", description);

  const { data } = await api.post<ProjectPhoto>(
    apiRoutes.projectPhotos(projectId),
    form
  );
  return data;
}

export async function deleteProjectPhoto(
  projectId: number,
  photoId: string
): Promise<void> {
  await api.delete(apiRoutes.projectPhoto(projectId, photoId));
}

/** URL for an <img src>. The browser sends the session cookie with it, and
 * the backend checks project access before returning the image. */
export function photoFileUrl(projectId: number, photoId: string): string {
  return `${api.defaults.baseURL}${apiRoutes.projectPhotoFile(projectId, photoId)}`;
}

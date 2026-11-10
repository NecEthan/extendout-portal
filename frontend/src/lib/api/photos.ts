import type { ProjectPhoto } from "@/interfaces";
import { api } from "./axiosClient";

export async function listProjectPhotos(
  projectId: number
): Promise<ProjectPhoto[]> {
  const { data } = await api.get<ProjectPhoto[]>(
    `/projects/${projectId}/photos`
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
    `/projects/${projectId}/photos`,
    form
  );
  return data;
}

/** URL for an <img src>. The browser sends the session cookie with it, and
 * the backend checks project access before returning the image. */
export function photoFileUrl(projectId: number, photoId: string): string {
  return `${api.defaults.baseURL}/projects/${projectId}/photos/${photoId}/file`;
}

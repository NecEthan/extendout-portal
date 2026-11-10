/** A site photo on a project (GET/POST /projects/{id}/photos). */
export interface ProjectPhoto {
  id: string;
  project_id: number;
  description: string | null;
  content_type: string;
  /** Uploader's name, or email if they have no name; null if deleted. */
  uploaded_by_name: string | null;
  created_at: string;
}

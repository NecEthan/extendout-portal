/** Every backend endpoint the app calls (relative to the API base URL).
 * Build API paths from here, never by hand. Ids are always encoded so they
 * can't change the path. Frontend pages live in `@/utils/applicationRoutes`. */

type Id = number | string;
const enc = (id: Id) => encodeURIComponent(id);

export const apiRoutes = {
  // Auth
  login: "/auth/login",
  logout: "/auth/logout",
  currentUser: "/auth/user",

  // Projects
  projects: "/projects",
  project: (projectId: Id) => `/projects/${enc(projectId)}`,
  projectMembers: (projectId: Id) => `/projects/${enc(projectId)}/members`,
  projectMember: (projectId: Id, userId: Id) =>
    `/projects/${enc(projectId)}/members/${enc(userId)}`,
  projectPhotos: (projectId: Id) => `/projects/${enc(projectId)}/photos`,
  projectPhoto: (projectId: Id, photoId: Id) =>
    `/projects/${enc(projectId)}/photos/${enc(photoId)}`,
  projectPhotoFile: (projectId: Id, photoId: Id) =>
    `/projects/${enc(projectId)}/photos/${enc(photoId)}/file`,

  // Documents
  documents: "/documents",
  document: (documentId: Id) => `/documents/${enc(documentId)}`,
  documentDownload: (documentId: Id) =>
    `/documents/${enc(documentId)}/download`,
  documentVersions: (documentId: Id) =>
    `/documents/${enc(documentId)}/versions`,
  activateDocumentVersion: (documentId: Id, versionId: Id) =>
    `/documents/${enc(documentId)}/versions/${enc(versionId)}/activate`,

  // Search
  query: "/query",

  // Team (admin only)
  team: "/team",
  teamMember: (userId: Id) => `/team/${enc(userId)}`,
};

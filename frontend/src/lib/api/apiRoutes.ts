type Id = number | string;
const enc = (id: Id) => encodeURIComponent(id);

export const apiRoutes = {
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    user: "/auth/user",
  },

  team: {
    list: "/team",
    member: (userId: Id) => `/team/${enc(userId)}`,
  },

  projects: {
    list: "/projects",
    project: (projectId: Id) => `/projects/${enc(projectId)}`,
    members: (projectId: Id) => `/projects/${enc(projectId)}/members`,
    member: (projectId: Id, userId: Id) =>
      `/projects/${enc(projectId)}/members/${enc(userId)}`,
    photos: (projectId: Id) => `/projects/${enc(projectId)}/photos`,
    photo: (projectId: Id, photoId: Id) =>
      `/projects/${enc(projectId)}/photos/${enc(photoId)}`,
    photoFile: (projectId: Id, photoId: Id) =>
      `/projects/${enc(projectId)}/photos/${enc(photoId)}/file`,
  },

  documents: {
    list: "/documents",
    document: (documentId: Id) => `/documents/${enc(documentId)}`,
    download: (documentId: Id) => `/documents/${enc(documentId)}/download`,
    versions: (documentId: Id) => `/documents/${enc(documentId)}/versions`,
    version: (documentId: Id, versionId: Id) =>
      `/documents/${enc(documentId)}/versions/${enc(versionId)}`,
    activateVersion: (documentId: Id, versionId: Id) =>
      `/documents/${enc(documentId)}/versions/${enc(versionId)}/activate`,
  },

  query: "/query",
};

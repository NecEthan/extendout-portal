/** Longest text each input accepts. Must match the backend's limits (the
 * backend rejects longer values with 422); `maxLength` stops people typing
 * or pasting past them. */
export const INPUT_LIMITS = {
  email: 320, // schemas/auth.py, schemas/team.py
  personName: 200, // schemas/team.py
  projectName: 200, // schemas/projects.py
  projectClient: 200,
  projectAddress: 500,
  documentTitle: 255, // schemas/documents.py MAX_TITLE_LENGTH
  photoDescription: 500, // schemas/photos.py MAX_DESCRIPTION_LENGTH
  question: 1000, // schemas/query.py MAX_QUESTION_CHARS
} as const;

import type { APIRequestContext } from "@playwright/test";
import { API } from "./env";

/** The last login code the backend "sent" to this email. Needs the backend's
 * EMAIL_BACKEND=outbox (local Docker and CI), which serves GET /dev/outbox. */
export async function latestLoginCode(
  request: APIRequestContext,
  email: string
): Promise<string> {
  const res = await request.get(`${API}/dev/outbox/${encodeURIComponent(email)}`);
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`no login code for ${email}: ${res.status()} ${body}`);
  }
  const { code } = await res.json();
  return code;
}

/** Log in through the API (request a code, read it, verify it). The session
 * cookie lands in `request`'s cookie jar. */
export async function loginByApi(request: APIRequestContext, email: string) {
  const sent = await request.post(`${API}/auth/request-code`, { data: { email } });
  if (!sent.ok()) throw new Error(`request code failed: ${sent.status()}`);
  const code = await latestLoginCode(request, email);
  const verified = await request.post(`${API}/auth/verify-code`, {
    data: { email, code },
  });
  if (!verified.ok()) {
    const body = await verified.text();
    throw new Error(`verify code failed: ${verified.status()} ${body}`);
  }
}

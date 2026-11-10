import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applicationRoutes } from "@/utils/applicationRoutes";

const PUBLIC_PATHS: string[] = [applicationRoutes.login];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("eo_ui_auth");

  if (!hasSession && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL(applicationRoutes.login, request.url));
  }

  if (hasSession && pathname === applicationRoutes.login) {
    return NextResponse.redirect(
      new URL(applicationRoutes.dashboard, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and public image files (e.g. /extendout-logo.png),
  // which must load without a session.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};

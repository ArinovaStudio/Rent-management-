import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";

// Guards /dashboard and /admin. If the access token is missing or expired, bounce through the
// refresh route, which rotates the refresh token and sends the user back here.
// /admin is for the Super Admin only; Super Admins manage properties under /admin, not /dashboard.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  const session = token ? await verifyAccessToken(token) : null;

  if (!session) {
    const url = new URL("/api/auth/refresh", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/admin") && session.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (session.role === "SUPER_ADMIN" && pathname.startsWith("/dashboard/properties")) {
    return NextResponse.redirect(
      new URL(pathname.replace("/dashboard/properties", "/admin/properties") + search, req.url)
    );
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*"] };
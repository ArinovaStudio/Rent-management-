import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";

// Guards /dashboard. If the access token is missing or expired, bounce through the
// refresh route, which rotates the refresh token and sends the user back here.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (token && (await verifyAccessToken(token))) return NextResponse.next();

  const url = new URL("/api/auth/refresh", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/dashboard/:path*"] };

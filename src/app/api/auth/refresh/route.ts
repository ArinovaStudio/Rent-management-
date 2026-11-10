import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, clearAuthCookies, rotateSession } from "@/lib/session";

function safePath(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

// Browser flow: middleware redirects here, we rotate the tokens, then go back to the page.
export async function GET(req: NextRequest) {
  const presented = req.cookies.get(REFRESH_COOKIE)?.value;
  const res = NextResponse.redirect(new URL(safePath(req.nextUrl.searchParams.get("next")), req.url));

  if (presented && (await rotateSession(res, presented))) return res;

  const login = NextResponse.redirect(new URL("/login", req.url));
  clearAuthCookies(login);
  return login;
}

// API flow: same rotation, JSON response.
export async function POST(req: NextRequest) {
  const presented = req.cookies.get(REFRESH_COOKIE)?.value;
  const res = NextResponse.json({ ok: true });

  if (presented && (await rotateSession(res, presented))) return res;

  const fail = NextResponse.json({ error: "Session expired." }, { status: 401 });
  clearAuthCookies(fail);
  return fail;
}

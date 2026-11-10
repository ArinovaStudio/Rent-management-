import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, clearAuthCookies, revokeFamily } from "@/lib/session";

export async function POST(req: NextRequest) {
  const presented = req.cookies.get(REFRESH_COOKIE)?.value;
  if (presented) await revokeFamily(presented);

  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  clearAuthCookies(res);
  return res;
}

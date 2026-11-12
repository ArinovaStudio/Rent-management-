import path from "path";
import { readFile } from "fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { UPLOAD_ROOT, MIME_BY_EXT } from "@/lib/uploads";

// Serves files from /uploads.
//   images/<file>             -> public (property photos shown on the website)
//   docs/<propertyId>/<file>  -> only the property's owner or a Super Admin
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const abs = path.resolve(UPLOAD_ROOT, ...segments);
  
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const contentType = MIME_BY_EXT[path.extname(abs).toLowerCase()];
  if (!contentType) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const isPublic = segments[0] === "images" || segments[0] === "videos";
  if (!isPublic) {
    const me = await getCurrentUser();
    if (!me) {
      // Access token probably expired: refresh, then come back to this file.
      const url = new URL("/api/auth/refresh", req.url);
      url.searchParams.set("next", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    const property = await prisma.property.findUnique({ where: { id: segments[1] ?? "" } });
    if (!property || !canEditProperty(me, property)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
  }

  try {
    const file = await readFile(abs);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": isPublic ? "public, max-age=86400" : "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}


import path from "path";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { UPLOAD_ROOT, MIME_BY_EXT } from "@/lib/uploads";

export async function GET(
  _req: Request,
  { params }: {
    params: Promise<{ token: string; docId: string }>
  }
) {
  const { token, docId } = await params;

  const document = await prisma.residentDocument.findFirst({
    where: {
      id: docId,
      allocation: { accessToken: token },
    },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Document not found." },
      { status: 404 }
    );
  }

  const abs = path.resolve(UPLOAD_ROOT, document.path);

  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) {
    return NextResponse.json(
      { error: "Not found." },
      { status: 404 }
    );
  }

  const contentType = MIME_BY_EXT[
    path.extname(abs).toLowerCase()
  ];

  if (!contentType) {
    return NextResponse.json(
      { error: "Not found." },
      { status: 404 }
    );
  }

  try {
    const file = await readFile(abs);

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(document.name).replace(/["\\]/g, "")}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Document not found." },
      { status: 404 }
    );
  }
}

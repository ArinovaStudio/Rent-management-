import { randomBytes } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

// Files live in <project>/uploads for now. Swap this file for S3/R2 later; nothing else changes.
export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const DOC_TYPES: Record<string, string> = { ...IMAGE_TYPES, "application/pdf": ".pdf" };

export const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export type FileKind = "image" | "doc";

// Returns an error message, or null if the file is fine.
export function checkFile(file: File, kind: FileKind): string | null {
  const types = kind === "image" ? IMAGE_TYPES : DOC_TYPES;
  if (!types[file.type]) {
    return `${file.name}: only ${kind === "image" ? "JPG, PNG or WebP" : "PDF, JPG, PNG or WebP"} files are allowed.`;
  }
  const max = kind === "image" ? 5 : 10;
  if (file.size > max * 1024 * 1024) return `${file.name}: file is larger than ${max} MB.`;
  return null;
}

// Saves the file and returns its path relative to the uploads folder, e.g. "images/ab12.jpg".
// The extension comes from our own whitelist, never from the uploaded file name.
export async function saveFile(file: File, folder: string, kind: FileKind) {
  const ext = (kind === "image" ? IMAGE_TYPES : DOC_TYPES)[file.type];
  const rel = `${folder}/${randomBytes(12).toString("hex")}${ext}`;
  const abs = path.join(UPLOAD_ROOT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return rel;
}

export async function removeFile(rel: string) {
  await unlink(path.join(UPLOAD_ROOT, rel)).catch(() => {});
}

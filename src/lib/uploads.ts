import { createHash, randomBytes } from "crypto";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

// Files live in <project>/uploads for now. Swap this file for S3/R2 later; nothing else changes.
export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

// KYC files live here instead. Nothing in the app serves this folder directly: files are only
// readable through /api/owner-documents/[id], which checks who is asking.
export const SENSITIVE_ROOT = path.join(process.cwd(), "private-uploads");

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const DOC_TYPES: Record<string, string> = { ...IMAGE_TYPES, "application/pdf": ".pdf" };
const VIDEO_TYPES: Record<string, string> = { "video/mp4": ".mp4", "video/webm": ".webm" };
const TYPES_BY_KIND = { image: IMAGE_TYPES, doc: DOC_TYPES, video: VIDEO_TYPES };
const KIND_LABEL = { image: "JPG, PNG or WebP", doc: "PDF, JPG, PNG or WebP", video: "MP4 or WebM" };
const MAX_MB = { image: 5, doc: 10, video: 50 };

export const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export type FileKind = "image" | "doc" | "video";

// Returns an error message, or null if the file is fine.
// Returns an error message, or null if the file is fine.
export function checkFile(file: File, kind: FileKind): string | null {
  if (!TYPES_BY_KIND[kind][file.type]) return `${file.name}: only ${KIND_LABEL[kind]} files are allowed.`;
  if (file.size > MAX_MB[kind] * 1024 * 1024) return `${file.name}: file is larger than ${MAX_MB[kind]} MB.`;
  return null;
}

// Saves the file and returns its path relative to the uploads folder, e.g. "images/ab12.jpg".
// The extension comes from our own whitelist, never from the uploaded file name.
export async function saveFile(file: File, folder: string, kind: FileKind) {
  const ext = TYPES_BY_KIND[kind][file.type];
  const rel = `${folder}/${randomBytes(12).toString("hex")}${ext}`;
  const abs = path.join(UPLOAD_ROOT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return rel;
}

export async function removeFile(rel: string) {
  await unlink(path.join(UPLOAD_ROOT, rel)).catch(() => {});
}

// ---- Sensitive (KYC) files ----

// file.type is whatever the browser claims, so for KYC files we also check the real bytes.
function sniffExt(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 4).toString("latin1") === "%PDF") return ".pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return ".webp";
  return null;
}

export type StoredSensitiveFile = { path: string; mimeType: string; sizeBytes: number; sha256: string };

// Validates the file's real content, then stores it under SENSITIVE_ROOT/<folder>/.
// Returns an error message or the stored file's details.
export async function saveSensitiveFile(
  file: File,
  folder: string
): Promise<{ error: string } | StoredSensitiveFile> {
  const bad = checkFile(file, "doc");
  if (bad) return { error: bad };
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffExt(buf);
  if (!ext || DOC_TYPES[file.type] !== ext) {
    return { error: `${file.name}: the file content doesn't match a PDF, JPG, PNG or WebP.` };
  }
  const rel = `${folder}/${randomBytes(16).toString("hex")}${ext}`;
  const abs = path.join(SENSITIVE_ROOT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf, { mode: 0o600 });
  return { path: rel, mimeType: MIME_BY_EXT[ext], sizeBytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
}

export async function removeSensitiveFile(rel: string) {
  await unlink(path.join(SENSITIVE_ROOT, rel)).catch(() => {});
}

// Reads a sensitive file back. All reads go through here, so moving to private encrypted object
// storage (S3/R2 with server-side encryption) means changing this file and saveSensitiveFile only.
export async function readSensitiveFile(rel: string): Promise<Buffer | null> {
  const abs = path.resolve(SENSITIVE_ROOT, rel);
  if (!abs.startsWith(SENSITIVE_ROOT + path.sep)) return null;
  return readFile(abs).catch(() => null);
}

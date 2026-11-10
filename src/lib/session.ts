import crypto from "crypto";
import type { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { signAccessToken, type Role } from "./jwt";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const secure = process.env.NODE_ENV === "production";

type SessionUser = { id: string; role: Role };
type Tx = Prisma.TransactionClient | typeof prisma;

// Creates a refresh token row (only its hash is stored) and returns the raw token
export async function createRefreshToken(db: Tx, userId: string, familyId: string) {
  const raw = crypto.randomBytes(32).toString("base64url");
  await db.refreshToken.create({
    data: {
      tokenHash: sha256(raw),
      familyId,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE * 1000),
    },
  });
  return raw;
}

export async function setAuthCookies(res: NextResponse, user: SessionUser, refreshToken: string) {
  res.cookies.set(ACCESS_COOKIE, await signAccessToken(user.id, user.role), {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: ACCESS_MAX_AGE,
  });
  // Refresh cookie is only sent to /api/auth/*
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true, secure, sameSite: "lax", path: "/api/auth", maxAge: REFRESH_MAX_AGE,
  });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { path: "/api/auth", maxAge: 0 });
}

// Every login starts a brand new token family with a brand new refresh token.
export async function startSession(res: NextResponse, user: SessionUser) {
  const refresh = await createRefreshToken(prisma, user.id, crypto.randomUUID());
  await setAuthCookies(res, user, refresh);
}

// Rotation: the presented token is marked used and replaced by a new one in the same family.
// Presenting an already-used or revoked token revokes the whole family (theft signal).
export async function rotateSession(res: NextResponse, presented: string): Promise<boolean> {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(presented) },
    include: { user: true },
  });
  if (!row) return false;

  if (row.usedAt || row.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return false;
  }
  if (row.expiresAt < new Date()) return false;

  const next = await prisma.$transaction(async (tx) => {
    // Only one request can flip usedAt from null; a concurrent replay gets count 0.
    const claimed = await tx.refreshToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return null;
    return createRefreshToken(tx, row.userId, row.familyId);
  });
  if (!next) return false;

  await setAuthCookies(res, { id: row.user.id, role: row.user.role }, next);
  return true;
}

export async function revokeFamily(presented: string) {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(presented) } });
  if (!row) return;
  await prisma.refreshToken.updateMany({
    where: { familyId: row.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

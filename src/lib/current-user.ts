import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { verifyAccessToken, type Role } from "./jwt";

// Returns the logged-in user from the database (so role changes apply immediately), or null.
// Cached per request: the layout, the page and every helper share one lookup instead of each hitting the DB.
// Nothing is kept between requests, so a role change still applies on the next request.
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get("access_token")?.value;
  const session = token ? await verifyAccessToken(token) : null;
  return session ? prisma.user.findUnique({ where: { id: session.userId } }) : null;
});

// Who is signed in, read from the access token only: no database query.
// Use it to render pages (name, role, id). It can be up to 15 minutes behind a role change or a deleted account,
// so anything that changes data or needs fresh facts about the user (every API route) still uses getCurrentUser().
export type SessionUser = { id: string; role: Role; name: string };
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get("access_token")?.value;
  const session = token ? await verifyAccessToken(token) : null;
  if (!session) return null;
  if (session.name) return { id: session.userId, role: session.role, name: session.name };
  // Token issued before names were added: one lookup, then it carries the name after the next refresh
  const user = await getCurrentUser();
  return user ? { id: user.id, role: user.role as Role, name: user.name } : null;
});

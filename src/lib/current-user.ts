import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { verifyAccessToken } from "./jwt";

// Returns the logged-in user from the database (so role changes apply immediately), or null.
// Cached per request: the layout, the page and every helper share one lookup instead of each hitting the DB.
// Nothing is kept between requests, so a role change still applies on the next request.
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get("access_token")?.value;
  const session = token ? await verifyAccessToken(token) : null;
  return session ? prisma.user.findUnique({ where: { id: session.userId } }) : null;
});

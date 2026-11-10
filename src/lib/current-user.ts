import { cookies } from "next/headers";
import { prisma } from "./db";
import { verifyAccessToken } from "./jwt";

// Returns the logged-in user from the database (so role changes apply immediately), or null.
export async function getCurrentUser() {
  const token = (await cookies()).get("access_token")?.value;
  const session = token ? await verifyAccessToken(token) : null;
  return session ? prisma.user.findUnique({ where: { id: session.userId } }) : null;
}
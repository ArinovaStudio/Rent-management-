import { PrismaClient } from "@prisma/client";

// One Prisma client per server process, in dev AND production.
// Dev hot-reload and warm serverless instances reuse it instead of opening a new connection pool every time.
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
g.prisma = prisma;

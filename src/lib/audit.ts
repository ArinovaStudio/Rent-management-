import { prisma } from "./db";

export async function getHistory(subjectType: "OWNER_KYC" | "PROPERTY", subjectId: string) {
  const events = await prisma.auditEvent.findMany({
    where: { subjectType, subjectId },
    orderBy: { createdAt: "desc" },
  });
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(events.map((e) => e.actorId))] } },
    select: { id: true, name: true },
  });
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return events.map((e) => ({ ...e, actorName: names.get(e.actorId) ?? "Owner" }));
}

export type HistoryEvent = Awaited<ReturnType<typeof getHistory>>[number];

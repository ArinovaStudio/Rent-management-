import { NextResponse } from "next/server";
import type { IssueStatus, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getVerificationStatus } from "@/lib/owner-status";
import { issueScope } from "@/lib/issues";

const RANK = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
const OPEN: IssueStatus[] = ["OPEN", "IN_PROGRESS"];
const OWNER_REVIEW: ReviewStatus[] = ["PENDING", "NEEDS_MORE_INFO", "REJECTED"];

type Item = { id: string; kind: "PROPERTY" | "KYC"; title: string; subtitle: string; status: string; href: string };

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Issues and the review queue don't depend on each other, so they all run at the same time.
  // Before: issues first, then the review queries one step later. Now: one round trip for everything.
  const [issueData, review] = await Promise.all([loadIssues(me), loadReview(me)]);

  return NextResponse.json({ issues: issueData, review });
}

type Me = { id: string; role: string };

async function loadIssues(me: Me) {
  const issueWhere = { ...issueScope(me as Parameters<typeof issueScope>[0]), status: { in: OPEN } };
  // Fetch one extra row so we only run a separate count when the queue is larger than the sort window.
  const rows = await prisma.issue.findMany({
    where: issueWhere,
    take: 51,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, priority: true, status: true, createdAt: true,
      property: { select: { name: true } }, room: { select: { label: true } },
    },
  });
  const overflow = rows.length > 50;
  const window = overflow ? rows.slice(0, 50) : rows;
  const total = overflow ? await prisma.issue.count({ where: issueWhere }) : rows.length;
  const items = window
    .sort((a, b) => RANK[a.priority] - RANK[b.priority])
    .slice(0, 8)
    .map((i) => ({
      id: i.id, title: i.title, priority: i.priority, status: i.status,
      place: `${i.property.name}${i.room ? ` · ${i.room.label}` : ""}`,
      createdAt: i.createdAt,
    }));
  return { total, items };
}

async function loadReview(me: Me): Promise<{ total: number; items: Item[] }> {
  if (me.role === "SUPER_ADMIN") {
    // One extra row each: skip the count queries while the pending queues are small (usual case).
    const [props, kyc] = await Promise.all([
      prisma.property.findMany({
        where: { status: "PENDING" }, orderBy: { updatedAt: "asc" }, take: 7,
        select: { id: true, name: true, city: true, owner: { select: { name: true } } },
      }),
      prisma.ownerProfile.findMany({
        where: { verificationStatus: "KYC_PENDING" }, orderBy: { createdAt: "asc" }, take: 7,
        select: { id: true, legalName: true, user: { select: { name: true } } },
      }),
    ]);
    const [propCount, kycCount] = await Promise.all([
      props.length < 7 ? props.length : prisma.property.count({ where: { status: "PENDING" } }),
      kyc.length < 7 ? kyc.length : prisma.ownerProfile.count({ where: { verificationStatus: "KYC_PENDING" } }),
    ]);
    return {
      total: propCount + kycCount,
      items: [
        ...props.slice(0, 6).map((p): Item => ({ id: p.id, kind: "PROPERTY", title: p.name, subtitle: `${p.city} · by ${p.owner.name}`, status: "PENDING", href: "/admin/approvals" })),
        ...kyc.slice(0, 6).map((k): Item => ({ id: k.id, kind: "KYC", title: k.legalName ?? k.user.name, subtitle: "Owner KYC", status: "KYC_PENDING", href: "/admin/kyc" })),
      ],
    };
  }

  if (me.role === "PROPERTY_ADMIN") {
    const [props, kycStatus] = await Promise.all([
      prisma.property.findMany({
        where: { ownerId: me.id, status: { in: OWNER_REVIEW } }, orderBy: { updatedAt: "desc" }, take: 8,
        select: { id: true, name: true, status: true, reviewNote: true },
      }),
      getVerificationStatus(me.id),
    ]);
    const items: Item[] = props.map((p) => ({
      id: p.id, kind: "PROPERTY", title: p.name,
      subtitle: p.reviewNote ?? (p.status === "PENDING" ? "Waiting for Super Admin review" : ""),
      status: p.status, href: `/dashboard/properties/${p.id}/edit`,
    }));
    if (kycStatus && kycStatus !== "VERIFIED") {
      items.unshift({ id: "kyc", kind: "KYC", title: "Your account verification", subtitle: "", status: kycStatus, href: "/dashboard" });
    }
    return { total: items.length, items };
  }

  return { total: 0, items: [] };
}

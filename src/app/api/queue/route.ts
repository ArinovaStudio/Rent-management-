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

  const issueWhere = { ...issueScope(me), status: { in: OPEN } };

  const [issueTotal, issueRows] = await Promise.all([
    prisma.issue.count({ where: issueWhere }),
    prisma.issue.findMany({
      where: issueWhere,
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, priority: true, status: true, createdAt: true,
        property: { select: { name: true } }, room: { select: { label: true } },
      },
    }),
  ]);
  const issues = issueRows
    .sort((a, b) => RANK[a.priority] - RANK[b.priority])
    .slice(0, 8)
    .map((i) => ({
      id: i.id, title: i.title, priority: i.priority, status: i.status,
      place: `${i.property.name}${i.room ? ` · ${i.room.label}` : ""}`,
      createdAt: i.createdAt,
    }));

  let review: { total: number; items: Item[] } = { total: 0, items: [] };

  if (me.role === "SUPER_ADMIN") {
    const [propCount, kycCount, props, kyc] = await Promise.all([
      prisma.property.count({ where: { status: "PENDING" } }),
      prisma.ownerProfile.count({ where: { verificationStatus: "KYC_PENDING" } }),
      prisma.property.findMany({
        where: { status: "PENDING" }, orderBy: { updatedAt: "asc" }, take: 6,
        select: { id: true, name: true, city: true, owner: { select: { name: true } } },
      }),
      prisma.ownerProfile.findMany({
        where: { verificationStatus: "KYC_PENDING" }, orderBy: { createdAt: "asc" }, take: 6,
        select: { id: true, legalName: true, user: { select: { name: true } } },
      }),
    ]);
    review = {
      total: propCount + kycCount,
      items: [
        ...props.map((p): Item => ({ id: p.id, kind: "PROPERTY", title: p.name, subtitle: `${p.city} · by ${p.owner.name}`, status: "PENDING", href: "/admin/approvals" })),
        ...kyc.map((k): Item => ({ id: k.id, kind: "KYC", title: k.legalName ?? k.user.name, subtitle: "Owner KYC", status: "KYC_PENDING", href: "/admin/kyc" })),
      ],
    };
  } else if (me.role === "PROPERTY_ADMIN") {
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
    review = { total: items.length, items };
  }

  return NextResponse.json({ issues: { total: issueTotal, items: issues }, review });
}
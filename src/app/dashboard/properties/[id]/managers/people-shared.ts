import { experienceText } from "@/lib/experience";
import type { Person, PersonKind } from "./person-dialogs";

// Fields read for every person card (owners and managers share them).
export const profileSel = { phone: true, age: true, photoPath: true, verificationStatus: true, addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, idType: true, idNumberMasked: true, appointedAt: true, pastExperienceMonths: true, documents: { select: { id: true, originalName: true, type: true }, orderBy: { uploadedAt: "asc" } } } as const;
export const userSel = { id: true, name: true, email: true, createdById: true, ownerProfile: { select: profileSel } } as const;

type Profile = { phone: string | null; age: number | null; photoPath: string | null; verificationStatus: string; addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null; idType: string | null; idNumberMasked: string | null; appointedAt: Date | null; pastExperienceMonths: number | null; documents: { id: string; originalName: string; type: string }[] } | null;
type U = { id: string; name: string; email: string; createdById: string | null; ownerProfile: Profile };

// Super Admin edits anyone; a Property Admin only the people they created. Documents are listed only for people the viewer may open.
export function makePerson(me: { id: string; role: string }, kind: PersonKind, u: U): Person {
  const editable = me.role === "SUPER_ADMIN" || (me.role === "PROPERTY_ADMIN" && kind !== "owner" && u.createdById === me.id);
  const canOpenDocs = editable || u.id === me.id || me.role === "SUPER_ADMIN";
  return {
    id: u.id, kind, name: u.name, email: u.email, editable,
    phone: u.ownerProfile?.phone ?? null, age: u.ownerProfile?.age ?? null, photoPath: u.ownerProfile?.photoPath ?? null,
    verified: u.ownerProfile?.verificationStatus === "VERIFIED",
    addressLine1: u.ownerProfile?.addressLine1 ?? null, addressLine2: u.ownerProfile?.addressLine2 ?? null,
    city: u.ownerProfile?.city ?? null, state: u.ownerProfile?.state ?? null, postalCode: u.ownerProfile?.postalCode ?? null,
    idType: u.ownerProfile?.idType ?? null, idNumberMasked: u.ownerProfile?.idNumberMasked ?? null,
    experience: experienceText(u.ownerProfile?.appointedAt ?? null, u.ownerProfile?.pastExperienceMonths ?? null),
    appointedAt: u.ownerProfile?.appointedAt?.toISOString().slice(0, 10) ?? null, pastMonths: u.ownerProfile?.pastExperienceMonths ?? null,
    documents: canOpenDocs ? (u.ownerProfile?.documents ?? []).map((d) => ({ id: d.id, name: d.originalName, type: d.type })) : [],
  };
}

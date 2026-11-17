import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate, nextRentDue } from "@/lib/bills";
import { PAYEE, RENT_TERMS } from "@/lib/payment";
import InvoiceView from "@/components/resident/InvoiceView";

export default async function RentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await prisma.allocation.findUnique({
    where: { accessToken: token },
    include: { room: { include: { property: true } } },
  });
  if (!a) notFound();
  const property = a.room.property;
  const due = nextRentDue(a.moveInDate);
  const ym = `${due.getFullYear()}${String(due.getMonth() + 1).padStart(2, "0")}`;
  const propertyAddress = `${property.address}, ${property.city}`;

  return (
    <InvoiceView
      data={{
        backHref: `/resident/${token}`,
        invoiceNo: `RENT-${ym}-${token.slice(0, 4).toUpperCase()}`,
        issueDate: fmtDate(new Date()),
        dueDate: fmtDate(due),
        paid: false,
        from: { name: property.name, address: propertyAddress },
        to: { name: a.fullName, address: `${a.room.label}, ${propertyAddress}`, phone: a.phone },
        items: [{ title: "Monthly rent", description: `${property.name} · ${a.room.label}`, rate: a.monthlyRent, taxPct: 0 }],
        terms: RENT_TERMS,
        payee: PAYEE,
      }}
    />
  );
}

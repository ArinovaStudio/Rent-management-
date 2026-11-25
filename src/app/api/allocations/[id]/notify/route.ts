import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import { notify } from "@/lib/mailer";
import { sendSms } from "@/lib/sms";
import { BILL_LABEL, billDueDate, fmtDate, inr, monthLabel } from "@/lib/bills";
import { RENT_TAX_KEY, taxRatesOf, withTax } from "@/lib/invoice";

// Reminds a tenant to pay. Only for unpaid rent / bills. Email if the tenant has one, otherwise SMS.
// { kind: "BILL", billId, fresh: true } is the "Send bill" button on a new bill: same delivery, but worded as a new bill, not a reminder.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const a = await prisma.allocation.findUnique({ where: { id }, include: { room: { include: { property: true } } } });
  if (!a || !(await canOperateProperty(me, a.room.property))) return NextResponse.json({ error: "You can't manage this resident." }, { status: 403 });
  if (a.status !== "ACTIVE") return NextResponse.json({ error: "This resident has checked out." }, { status: 409 });

  const b = await req.json().catch(() => ({}));
  const origin = process.env.APP_URL ?? new URL(req.url).origin;
  const property = a.room.property.name;
  let subject: string, body: string;

  if (b.kind === "RENT") {
    const period = String(b.period ?? "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ error: "Choose a valid month." }, { status: 400 });
    const pay = await prisma.rentPayment.findUnique({ where: { allocationId_period: { allocationId: id, period } } });
    if (pay?.paid) return NextResponse.json({ error: "Rent is already paid." }, { status: 409 });
    subject = `Rent reminder · ${monthLabel(period)} · ${property}`;
    body = `Hello ${a.fullName},\n\nYour rent of ${inr(withTax(a.monthlyRent, taxRatesOf(a.taxRates)[RENT_TAX_KEY] ?? 0))} for ${monthLabel(period)} (${a.roomLabel ?? a.room.label}, ${property}) is pending. Please complete the payment here:\n${origin}/resident/${a.accessToken}/rent\n\nIgnore this message if you have already paid.`;
  } else if (b.kind === "BILL") {
    const bill = await prisma.residentBill.findFirst({ where: { id: String(b.billId ?? ""), allocationId: id } });
    if (!bill) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    if (bill.paid) return NextResponse.json({ error: "This bill is already paid." }, { status: 409 });
    const total = inr(withTax(bill.amount, bill.taxPct));
    const link = `${origin}/resident/${a.accessToken}/bill/${bill.id}`;
    const what = `${BILL_LABEL[bill.type].toLowerCase()} bill of ${total} for ${monthLabel(bill.period)} (${a.roomLabel ?? a.room.label}, ${property})`;
    if (b.fresh === true) {
      subject = `New ${BILL_LABEL[bill.type].toLowerCase()} bill · ${monthLabel(bill.period)} · ${property}`;
      body = `Hello ${a.fullName},\n\nYour ${what} is ready. Please pay it by ${fmtDate(billDueDate(bill.period))}. You can see the invoice and pay here:\n${link}\n\nIgnore this message if you have already paid.`;
    } else {
      subject = `${BILL_LABEL[bill.type]} bill reminder · ${monthLabel(bill.period)} · ${property}`;
      body = `Hello ${a.fullName},\n\nYour ${what} is pending. It was due on ${fmtDate(billDueDate(bill.period))}. Please complete the payment here:\n${link}\n\nIgnore this message if you have already paid.`;
    }
  } else {
    return NextResponse.json({ error: "Nothing to notify about." }, { status: 400 });
  }

  const channel = a.email ? "email" : "sms";
  const sent = a.email ? await notify(a.email, subject, body) : await sendSms(a.phone, body);
  const to = a.email ?? a.phone;
  return NextResponse.json({
    channel, sent,
    message: sent
      ? `${b.kind === "BILL" && b.fresh === true ? "Bill" : "Reminder"} sent by ${channel} to ${to}.`
      : channel === "email" ? "Email could not be sent. Check the SMTP settings." : "This tenant has no email, and SMS is not set up yet, so nothing was sent.",
  }, { status: sent ? 200 : 502 });
}

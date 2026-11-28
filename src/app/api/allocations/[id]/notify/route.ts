import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty, operableAllocationSelect } from "@/lib/property-access";
import { notify } from "@/lib/mailer";
import { sendSms } from "@/lib/sms";
import { BILL_LABEL, billDueDate, fmtDate, inr, monthLabel } from "@/lib/bills";
import { RENT_TAX_KEY, taxRatesOf, withTax } from "@/lib/invoice";

// Reminds a tenant to pay. Only for unpaid rent / bills. Email if the tenant has one, otherwise SMS.
// { kind: "BILL", billId, fresh: true } is the "Send bill" button on a new bill: same delivery, but worded as a new bill, not a reminder.
// { kind: "BILL", billId, updated: true } tells the tenant an existing bill was changed.
// { kind: "BILLS" } is one email listing every unpaid bill.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const a = await prisma.allocation.findUnique({ where: { id }, select: operableAllocationSelect });
  if (!a || !(await canOperateProperty(me, a.room.property))) return NextResponse.json({ error: "You can't manage this resident." }, { status: 403 });
  if (a.status !== "ACTIVE") return NextResponse.json({ error: "This resident has checked out." }, { status: 409 });

  const b = await req.json().catch(() => ({}));
  const origin = process.env.APP_URL ?? new URL(req.url).origin;
  const property = a.room.property.name;
  let subject: string, body: string;

  if (b.kind === "RENT") {
    const period = String(b.period ?? "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ error: "Choose a valid month." }, { status: 400 });
    const pay = await prisma.rentPayment.findUnique({
      where: { allocationId_period: { allocationId: id, period } },
      select: { paid: true },
    });
    if (pay?.paid) return NextResponse.json({ error: "Rent is already paid." }, { status: 409 });
    subject = `Rent reminder · ${monthLabel(period)} · ${property}`;
    body = `Hello ${a.fullName},\n\nYour rent of ${inr(withTax(a.monthlyRent, taxRatesOf(a.taxRates)[RENT_TAX_KEY] ?? 0))} for ${monthLabel(period)} (${a.roomLabel ?? a.room.label}, ${property}) is pending. Please complete the payment here:\n${origin}/resident/${a.accessToken}/rent\n\nIgnore this message if you have already paid.`;
  } else if (b.kind === "BILL") {
    const bill = await prisma.residentBill.findFirst({
      where: { id: String(b.billId ?? ""), allocationId: id },
      select: { id: true, paid: true, amount: true, taxPct: true, type: true, period: true },
    });
    if (!bill) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    if (bill.paid) return NextResponse.json({ error: "This bill is already paid." }, { status: 409 });
    const total = inr(withTax(bill.amount, bill.taxPct));
    const link = `${origin}/resident/${a.accessToken}/bill/${bill.id}`;
    const what = `${BILL_LABEL[bill.type].toLowerCase()} bill of ${total} for ${monthLabel(bill.period)} (${a.roomLabel ?? a.room.label}, ${property})`;
    if (b.updated === true) {
      subject = `Updated ${BILL_LABEL[bill.type].toLowerCase()} bill · ${monthLabel(bill.period)} · ${property}`;
      body = `Hello ${a.fullName},\n\nYour ${what} has been updated. Please pay the updated amount by ${fmtDate(billDueDate(bill.period))}. You can see the invoice and pay here:\n${link}\n\nIgnore this message if you have already paid.`;
    } else if (b.fresh === true) {
      subject = `New ${BILL_LABEL[bill.type].toLowerCase()} bill · ${monthLabel(bill.period)} · ${property}`;
      body = `Hello ${a.fullName},\n\nYour ${what} is ready. Please pay it by ${fmtDate(billDueDate(bill.period))}. You can see the invoice and pay here:\n${link}\n\nIgnore this message if you have already paid.`;
    } else {
      subject = `${BILL_LABEL[bill.type]} bill reminder · ${monthLabel(bill.period)} · ${property}`;
      body = `Hello ${a.fullName},\n\nYour ${what} is pending. It was due on ${fmtDate(billDueDate(bill.period))}. Please complete the payment here:\n${link}\n\nIgnore this message if you have already paid.`;
    }
  } else if (b.kind === "BILLS") {
    const bills = await prisma.residentBill.findMany({
      where: { allocationId: id, paid: false }, orderBy: { period: "asc" }, take: 50,
      select: { id: true, type: true, period: true, amount: true, taxPct: true },
    });
    // if (bills.length === 0) return NextResponse.json({ error: "There are no unpaid bills." }, { status: 409 });
    const period = String(b.period ?? "");
    let rentDue = 0;
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      const pay = await prisma.rentPayment.findUnique({ where: { allocationId_period: { allocationId: id, period } }, select: { paid: true } });
      if (!pay?.paid) rentDue = withTax(a.monthlyRent, taxRatesOf(a.taxRates)[RENT_TAX_KEY] ?? 0);
    }
    if (bills.length === 0 && rentDue <= 0) return NextResponse.json({ error: "There are no unpaid bills or rent." }, { status: 409 });

    const lines = bills.map((x) => `• ${BILL_LABEL[x.type]} · ${monthLabel(x.period)}: ${inr(withTax(x.amount, x.taxPct))} (due ${fmtDate(billDueDate(x.period))})\n  ${origin}/resident/${a.accessToken}/bill/${x.id}`);
    if (rentDue > 0) lines.unshift(`• Rent · ${monthLabel(period)}: ${inr(rentDue)}\n  ${origin}/resident/${a.accessToken}/rent`);
    const sum = bills.reduce((s, x) => s + withTax(x.amount, x.taxPct), 0) + (rentDue > 0 ? rentDue : 0);
    const count = bills.length + (rentDue > 0 ? 1 : 0);
    subject = `${count} pending ${count === 1 ? "payment" : "payments"} · ${property}`;
    body = `Hello ${a.fullName},\n\nThese payments for ${a.roomLabel ?? a.room.label}, ${property} are still unpaid:\n\n${lines.join("\n")}\n\nTotal pending: ${inr(sum)}\n\nOpen a link above to see the invoice and pay. Ignore this message if you have already paid.`;
  } else {
    return NextResponse.json({ error: "Nothing to notify about." }, { status: 400 });
  }

  const channel = a.email ? "email" : "sms";
  const sent = a.email ? await notify(a.email, subject, body) : await sendSms(a.phone, body);
  const to = a.email ?? a.phone;
  return NextResponse.json({
    channel, sent,
    message: sent
      ? `${b.kind === "BILL" && (b.fresh === true || b.updated === true) ? (b.updated === true ? "Updated bill" : "Bill") : "Reminder"} sent by ${channel} to ${to}.`
      : channel === "email" ? "Email could not be sent. Check the SMTP settings." : "This tenant has no email, and SMS is not set up yet, so nothing was sent.",
  }, { status: sent ? 200 : 502 });
}

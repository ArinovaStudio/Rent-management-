import nodemailer from "nodemailer";

// SMTP settings come from env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.
export function transport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

// Best-effort notification email. Never throws; returns whether it was sent.
// In development without SMTP the message is printed to the console instead.
export async function notify(to: string, subject: string, text: string): Promise<boolean> {
  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV !== "production") console.log(`[dev] SMTP not configured. Email to ${to}: ${subject}\n${text}`);
    return false;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM ?? process.env.SMTP_USER, to, subject, text });
    return true;
  } catch {
    return false;
  }
}

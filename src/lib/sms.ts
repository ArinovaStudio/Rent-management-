// SMS is not set up yet. Plug a provider in here (Twilio, MSG91...) and every caller starts sending.
// Returns whether the message was sent.
export async function sendSms(to: string, text: string): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") console.log(`[dev] SMS not configured. SMS to ${to}:\n${text}`);
  return false;
}

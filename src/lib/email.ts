import type { Env } from "../env";

export interface SendEmailResult {
  sent: boolean;
  stub?: boolean;
  error?: string;
}

// Thin wrapper around Resend's transactional email HTTP API. Used both for
// real emails (owner notifications) and for email-to-SMS gateway addresses
// (reservation confirmations), since carrier gateways just treat the body
// of a plain email as the text message.
//
// Resend requires sending `from` a domain you've verified on your Resend
// account (https://resend.com/domains) — set RESEND_FROM_EMAIL once you
// have one live.
export async function sendTransactionalEmail(
  env: Env,
  params: { to: string; subject: string; text: string }
): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.log(`[MAIL STUB] To ${params.to} (${params.subject}): ${params.text}`);
    return { sent: false, stub: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend send failed:", errorText);
      return { sent: false, error: errorText };
    }

    return { sent: true };
  } catch (err) {
    console.error("Resend send error:", err);
    return { sent: false, error: (err as Error).message };
  }
}

import type { Env } from "../env";

// Email-to-SMS gateway domains for major US carriers. Sending a plain
// email to <10-digit-number>@<domain> delivers it as a text message,
// which sidesteps A2P 10DLC registration entirely — at the cost of only
// covering carriers we can recognize and no delivery receipts.
const CARRIER_GATEWAYS: Record<string, string> = {
  "at&t": "txt.att.net",
  "t-mobile": "tmomail.net",
  metropcs: "mymetropcs.com",
  verizon: "vtext.com",
  sprint: "messaging.sprintpcs.com",
  "boost mobile": "sms.myboostmobile.com",
  boost: "sms.myboostmobile.com",
  cricket: "sms.cricketwireless.net",
  "us cellular": "email.uscc.net",
  "google fi": "msg.fi.google.com",
  "virgin mobile": "vmobl.com",
  mint: "mailmymobile.net",
};

function matchGatewayDomain(carrierName: string): string | null {
  const normalized = carrierName.toLowerCase();
  for (const [needle, domain] of Object.entries(CARRIER_GATEWAYS)) {
    if (normalized.includes(needle)) return domain;
  }
  return null;
}

export interface CarrierLookupResult {
  gatewayAddress: string;
  carrier: string;
}

export type CarrierLookupError =
  | { reason: "not-configured" }
  | { reason: "invalid-number" }
  | { reason: "unsupported-carrier"; carrier: string }
  | { reason: "lookup-failed"; message: string };

// Looks up the carrier for a US phone number via Veriphone and maps it to
// an email-to-SMS gateway address. Returns a discriminated error instead
// of throwing so callers can show a specific message to the reservation
// form.
export async function resolveSmsGateway(
  env: Env,
  phone: string
): Promise<CarrierLookupResult | CarrierLookupError> {
  const apiKey = env.VERIPHONE_API_KEY;
  if (!apiKey) return { reason: "not-configured" };

  const digits = phone.replace(/\D/g, "");
  const tenDigit = digits.slice(-10);
  if (tenDigit.length !== 10) return { reason: "invalid-number" };

  try {
    const url = `https://api.veriphone.io/v2/verify?phone=${encodeURIComponent(phone)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return { reason: "lookup-failed", message: `Veriphone returned ${res.status}` };

    const data = (await res.json()) as {
      phone_valid?: boolean;
      phone_type?: string;
      carrier?: string;
    };

    if (!data.phone_valid) return { reason: "invalid-number" };

    const carrier = data.carrier ?? "";
    const domain = matchGatewayDomain(carrier);
    if (!domain) return { reason: "unsupported-carrier", carrier };

    return { gatewayAddress: `${tenDigit}@${domain}`, carrier };
  } catch (err) {
    return { reason: "lookup-failed", message: (err as Error).message };
  }
}

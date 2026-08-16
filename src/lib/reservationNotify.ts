import type { Env } from "../env";
import { resolveSmsGateway } from "./carrierGateway";
import { sendTransactionalEmail } from "./email";

export interface ReservationNotifyResult {
  sent: boolean;
  stub?: boolean;
  error?: string;
  message: string;
}

// "SMS" confirmation without an SMS provider: look up the recipient's
// carrier via Veriphone, then email their carrier's SMS gateway address
// (e.g. 5551234567@txt.att.net) through Resend. The carrier turns that
// plain email into a text message on the phone.
export async function sendReservationSms(
  env: Env,
  phone: string,
  message: string
): Promise<ReservationNotifyResult> {
  const gateway = await resolveSmsGateway(env, phone);

  if ("reason" in gateway) {
    switch (gateway.reason) {
      case "not-configured":
        console.log(`[SMS STUB] Would text ${phone}: ${message}`);
        return { sent: false, stub: true, message };
      case "invalid-number":
        return { sent: false, error: "Couldn't verify that phone number.", message };
      case "unsupported-carrier":
        return {
          sent: false,
          error: `We don't have a text gateway for ${gateway.carrier || "that carrier"} yet.`,
          message,
        };
      case "lookup-failed":
        return { sent: false, error: "Carrier lookup failed. Please try again.", message };
    }
  }

  const result = await sendTransactionalEmail(env, {
    to: gateway.gatewayAddress,
    subject: "",
    text: message,
  });
  if (!result.sent) {
    return { sent: false, stub: result.stub, error: result.error, message };
  }

  return { sent: true, message };
}

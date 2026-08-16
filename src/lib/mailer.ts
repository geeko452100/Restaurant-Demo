import type { Env } from "../env";
import { sendTransactionalEmail } from "./email";

// Fire-and-forget notification email, scheduled with `ctx.waitUntil` so it
// runs after the response is sent instead of blocking the client on the
// mail provider's round trip.
export function notifyOwnerOfBandApplication(
  env: Env,
  ctx: { waitUntil(promise: Promise<unknown>): void },
  params: { bandName: string; genre: string; rate?: number; email: string; mediaLink: string }
) {
  const ownerEmail = env.OWNER_NOTIFICATION_EMAIL;
  if (!ownerEmail) {
    console.log(`[MAIL STUB] New band application: ${params.bandName} (${params.genre})`);
    return;
  }

  const rateLine = params.rate != null ? `\nRequested rate: $${params.rate}` : "";
  const send = sendTransactionalEmail(env, {
    to: ownerEmail,
    subject: `New band application: ${params.bandName}`,
    text: `${params.bandName} (${params.genre}) applied to play.${rateLine}\nContact: ${params.email}\nMedia: ${params.mediaLink}`,
  }).catch((err) => console.error("Owner notification failed:", err));

  ctx.waitUntil(send);
}

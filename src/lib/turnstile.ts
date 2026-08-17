// Canonical Turnstile siteverify check (see
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
// Fails closed on any network/parse error, action mismatch, or hostname not
// in the allowlist.
interface SiteverifyResult {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export async function verifyTurnstile(
  secret: string,
  token: unknown,
  expectedAction: string,
  hostnameAllowlist: string,
  remoteIp: string
): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  const expectedHostnames = new Set(
    hostnameAllowlist
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean)
  );
  if (expectedHostnames.size === 0) return false;

  let result: SiteverifyResult;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ secret, response: token, remoteip: remoteIp }),
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    result = await res.json();
  } catch {
    return false;
  }

  return (
    result.success === true &&
    result.action === expectedAction &&
    !!result.hostname &&
    expectedHostnames.has(result.hostname)
  );
}

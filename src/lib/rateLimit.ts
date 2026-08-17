// Thin wrapper around Cloudflare's Rate Limiting binding (RateLimit). Unlike
// an in-memory counter, this is durable and shared across edge locations —
// see the LOGIN_RATE_LIMITER / PUBLIC_FORM_RATE_LIMITER bindings in
// wrangler.toml.
export async function checkRateLimit(limiter: RateLimit, key: string): Promise<boolean> {
  const { success } = await limiter.limit({ key });
  return success;
}

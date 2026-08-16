export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  // Owner login (see src/lib/auth.ts). No users table — single-owner demo.
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string;
  AUTH_SECRET: string;

  // Carrier lookup for the email-to-SMS gateway (https://veriphone.io).
  VERIPHONE_API_KEY?: string;

  // Transactional email (https://resend.com). RESEND_FROM_EMAIL must be on
  // a domain verified in your Resend account.
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  OWNER_NOTIFICATION_EMAIL?: string;
}

# Acme Restaurant — Demo Site

An interactive website concept by Prairie Web Studio for a fictional neighborhood restaurant. It's a **demo only** — the restaurant, menu, and events are all made up — built to show a restaurant owner what a working site could do for them.

**What customers can do**
- Browse the menu (burgers, appetizers, drinks) with live "sold out" / 86'd status
- See today's lunch special or tonight's event on the homepage
- Order food and soft drinks online for pickup, then watch the order status update live
- Reserve a table by picking a seat on the floor plan
- Check the calendar for food events like tasting dinners and cook-offs

**What staff can do** (at `/admin`)
- **Orders** — work incoming pickup orders (New → Preparing → Ready → Picked Up) and record cash or card payments, with a running total of today's sales
- **Menu & Specials** — add, edit, 86, or hide menu items and categories, and set each day's lunch special
- **Events** and **Bookings** — manage the events calendar, and see or cancel reservations

## Demo login

| Email | Password |
| --- | --- |
| `staff@example.com` | `Password123!` |

This account is created by the seed data (`src/db/seed.sql`).

## Tech stack

- **Cloudflare Workers** running a [Hono](https://hono.dev) API (`src/index.ts`)
- **Cloudflare D1** (SQLite) through [Drizzle ORM](https://orm.drizzle.team)
- **Static HTML + vanilla JS** in `public/`, served by Workers static assets
- **Tailwind CSS**, compiled from `src/input.css` to `public/css/style.css`
- **Turnstile** and **Rate Limiting** bindings protect the login and public forms

## Getting started

Requires Node 22+ and a Cloudflare account (for deploying — local dev works without one).

```bash
npm install
cp .dev.vars.example .dev.vars   # then fill in AUTH_SECRET (see below)
npm run build:css
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Open http://localhost:8787 for the site, or http://localhost:8787/admin/login.html to sign in as staff.

If you're editing styles, run `npm run watch:css` in a second terminal.

## Configuration

Local secrets go in `.dev.vars` (gitignored). In production, set each one with `npx wrangler secret put <NAME>`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | Yes | Signs staff session cookies. Any long random string, e.g. `openssl rand -hex 32`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | No | An optional owner login on top of the staff accounts. Generate the hash with `npm run hash-password -- "<AUTH_SECRET>" "<password>"`, and regenerate it whenever `AUTH_SECRET` changes. |
| `TURNSTILE_SECRET` | Yes, for the reservation form | Turnstile secret key. The site key is in `reserve.html`. |
| `TURNSTILE_HOSTNAMES` | Yes, for the reservation form | Comma-separated hostnames Turnstile should accept, e.g. `localhost,127.0.0.1,your-site.workers.dev`. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | No | Sends email through [Resend](https://resend.com), used for reservation texts. Without them, messages are just logged to the console. |
| `VERIPHONE_API_KEY` | No | Looks up a guest's phone carrier so reservation confirmations can go out as a text via the carrier's email-to-SMS gateway. Logged to the console when unset. |

### Adding staff accounts

```bash
npm run hash-password -- --staff someone@example.com 'their-password'
```

This prints an `INSERT` statement. Run it with `npx wrangler d1 execute acme-restaurant-db --local --command "<statement>"` (or `--remote`), or paste it into `src/db/seed.sql`.

## Deploying

1. Create the database once with `npx wrangler d1 create acme-restaurant-db`, and put the printed ID in `wrangler.toml` as `database_id`.
2. Set the secrets above with `npx wrangler secret put <NAME>`.
3. Apply migrations with `npm run db:migrate:remote`.
4. Load the demo data the first time with `npm run db:seed:remote`. It only runs cleanly on an empty database.
5. Run `npm run deploy`, which builds the CSS and deploys the Worker.

A cron trigger runs every 20 minutes to tick down the "servings remaining" count on tracked drinks between 11am and 11pm Central. It's purely cosmetic, so the tap list looks alive during a demo.

## Database changes

1. Edit `src/db/schema.ts`.
2. Run `npm run db:generate` to create a migration in `drizzle/migrations/`.
3. Apply it with `npm run db:migrate:local`, and later with `npm run db:migrate:remote`.

`npm run db:studio` opens Drizzle Studio for browsing the data.

## How a few things work

- **Time zone.** The restaurant runs on Central Time. "Today," the lunch window, pickup slots, and the daily special are all worked out in `America/Chicago`, whatever the visitor's time zone.
- **Online orders.** Only food and non-alcoholic drinks can be ordered; beer and cocktails are dine-in only. A day's lunch special can only be ordered on that day. The server prices every order from the database and adds a flat 8.5% sales tax (`TAX_RATE` in `src/lib/orders.ts`). Customers pay at pickup, and staff record the payment on the Orders board. An order can't be marked picked up until it's paid.
- **Reservations.** The floor plan (bar stools, booths, two-tops) is defined in `src/lib/seatLayout.ts`. Each booking holds its seat for two hours.
- **Events.** Each event has an optional per-person price (0 means free). Clicking an event opens the reservation page for that date.
- **Lunch specials.** A menu item with a day of the week set is that day's special. It shows in the homepage banner and can be ordered online on that day.

## Project layout

```
public/              Static site (HTML pages, JS, images, compiled CSS)
  admin/             Staff pages (orders, menu & specials, events, bookings)
  js/                One script per page
src/
  index.ts           Worker entry: every /api route plus the cron handler
  db/                Drizzle schema, queries, and seed data
  lib/               Auth, orders, seating, email/SMS, Turnstile, rate limiting
drizzle/migrations/  SQL migrations applied by Wrangler
scripts/             Password-hash helper
```

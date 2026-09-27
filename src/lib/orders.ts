import type { MenuItem } from "../db/schema";

// Flat sales tax applied to every online order. Demo value — set this to
// the venue's real combined state + local rate before going live.
export const TAX_RATE = 0.085;

// What a customer can put in an online pickup order. Alcoholic drinks
// (abv > 0) are dine-in only, and a day-of-week lunch special is only
// orderable on its own day (Central Time, same as the homepage banner).
export function isOrderable(item: MenuItem, todayDayOfWeek: number) {
  if (!item.isActive || !item.isAvailable) return false;
  if (item.abv != null && item.abv > 0) return false;
  if (item.dayOfWeek != null && item.dayOfWeek !== todayDayOfWeek) return false;
  return true;
}

// All money math is done in integer cents so a cart of $7.99 items never
// totals to $23.969999.
export function priceOrder(lines: { unitPrice: number; quantity: number }[]) {
  const subtotalCents = lines.reduce((sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity, 0);
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  return {
    subtotal: subtotalCents / 100,
    tax: taxCents / 100,
    total: (subtotalCents + taxCents) / 100,
  };
}

import type { TicketSource } from "@frak-labs/backend-elysia/domain/game/schemas";

/** The backend's per-source ticket amounts; `ticketAmounts.test.ts` fails when they drift. */
export const TICKET_AMOUNTS = {
    join: 1,
    instagramCertified: 1,
    purchase: 3,
    referredPurchase: 3,
    referredSignup: 2,
    brandShare: 2,
} as const satisfies Record<TicketSource, number>;

export function totalTickets(breakdown: Record<TicketSource, number>) {
    return Object.values(breakdown).reduce((sum, n) => sum + n, 0);
}

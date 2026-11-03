export const TICKET_AMOUNTS = {
    join: 1,
    instagramCertified: 2,
    purchase: 3,
    referredPurchase: 3,
    referredSignup: 1,
    brandShare: 1,
} as const;

export type TicketSource = keyof typeof TICKET_AMOUNTS;

/** Tickets earned per source, already multiplied by their amount. */
export type TicketBreakdown = Record<TicketSource, number>;

export const NO_TICKETS: TicketBreakdown = {
    join: 0,
    instagramCertified: 0,
    purchase: 0,
    referredPurchase: 0,
    referredSignup: 0,
    brandShare: 0,
};

export function totalTickets(breakdown: TicketBreakdown): number {
    return Object.values(breakdown).reduce((sum, n) => sum + n, 0);
}

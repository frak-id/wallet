/**
 * Shared TTL for the install-ticket JWT and the pending-action store that
 * carries it across the unauthenticated → authenticated boundary
 * (`docs/plans/identity-proof-of-possession/README.md` §5, "Ticket
 * design"). A shorter ticket than the pending action means the wallet
 * drains a dead one; a longer one is bearer material outliving its
 * purpose. Both sides import this single constant so they can never drift
 * apart.
 */
export const INSTALL_TICKET_TTL_MS = 7 * 24 * 60 * 60 * 1000; // One week

/**
 * Shared TTL for the install-ticket JWT and the pending-action store that
 * carries it. A shorter ticket than the pending action means the wallet
 * drains a dead one; a longer one is bearer material outliving its purpose.
 */
export const INSTALL_TICKET_TTL_MS = 7 * 24 * 60 * 60 * 1000; // One week

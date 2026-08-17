/**
 * TTL for the wallet's pending-action store, which carries the install ticket.
 *
 * Must stay >= the server's ticket TTL: a store entry shorter than the ticket
 * drops a still-valid credential, and this value is compiled into the store
 * binary, so it can only move on a coordinated release.
 */
export const INSTALL_TICKET_CLIENT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // One week

/**
 * Default TTL for the install-ticket JWT the backend mints. The server reads
 * `INSTALL_TICKET_TTL_SECONDS` over this, so it can be cut without a release
 * — but never past `INSTALL_TICKET_CLIENT_TTL_MS` on a deployed wallet.
 */
export const INSTALL_TICKET_SERVER_TTL_MS = 7 * 24 * 60 * 60 * 1000; // One week

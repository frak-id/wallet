/**
 * TTL of the install-ticket JWT, mirrored by the wallet's pending-action store
 * so a stored entry never outlives the credential it carries — or drops one
 * that is still valid. Compiled into the store binary, so it can only move on
 * a coordinated backend + wallet release.
 */
export const INSTALL_TICKET_TTL_MS = 7 * 24 * 60 * 60 * 1000; // One week

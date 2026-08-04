/**
 * Carries the backend's typed error `code` (e.g. `DOMAIN_ALREADY_CLAIMED`) out
 * of an allow-list mutation, so the sheet can map the one outcome a user can
 * act on to a translated message instead of echoing the raw backend string.
 */
export class AllowedListError extends Error {
    constructor(readonly code: string | undefined) {
        super(code ?? "ALLOWED_LIST_FAILED");
        this.name = "AllowedListError";
    }
}

import type { SharingSearch } from "./params/table";

/** A native launch with no `clientId` is a host integration bug: the host owns the identity. */
export class MissingHostClientIdError extends Error {
    constructor(
        readonly returnScheme: string | undefined,
        readonly sid: string | undefined
    ) {
        super(
            "sharing: `clientId` is required when `embed` is set. The host owns the caller identity; the wallet's own stored id must not stand in for it."
        );
        this.name = "MissingHostClientIdError";
    }
}

/**
 * Throws when an embedded launch omits the caller identity. Shared by the SPA
 * route's `beforeLoad` and the standalone `/sharing` entrypoint, so both
 * surfaces reject the same launches for the same reason.
 */
export function assertHostClientId(search: {
    embed?: unknown;
    clientId?: string;
    returnScheme?: string;
    sid?: string;
}): void {
    if (search.embed && !search.clientId) {
        throw new MissingHostClientIdError(search.returnScheme, search.sid);
    }
}

/** Narrowing helper kept next to the error so the two never drift apart. */
export function isMissingHostClientIdError(
    error: unknown
): error is MissingHostClientIdError {
    return error instanceof MissingHostClientIdError;
}

export type { SharingSearch };

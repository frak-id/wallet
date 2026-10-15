import { HttpError } from "@backend-utils";
import { moneriumErrorCodes } from "./schemas";

/** Failed Monerium call. `status` is 0 when no HTTP answer came back (network error, timeout). */
export class MoneriumApiError extends Error {
    constructor(
        readonly status: number,
        readonly moneriumCode: string | undefined,
        message: string,
        readonly retryAfterSeconds?: number
    ) {
        super(message);
        this.name = "MoneriumApiError";
    }

    /** 429, 5xx and transport failures: nothing the caller can fix by changing its input. */
    get isUpstreamFailure(): boolean {
        return this.status === 0 || this.status === 429 || this.status >= 500;
    }
}

export function upstreamUnavailable(): HttpError {
    return HttpError.badGateway(
        moneriumErrorCodes.upstreamUnavailable,
        "Monerium is not available right now"
    );
}

export function notConnected(): HttpError {
    return HttpError.conflict(
        moneriumErrorCodes.notConnected,
        "No Monerium account is connected to this wallet"
    );
}

export function reauthRequired(): HttpError {
    return HttpError.conflict(
        moneriumErrorCodes.reauthRequired,
        "The Monerium connection has expired, reconnect it"
    );
}

/** A Monerium failure the caller has no specific answer for becomes 502; other errors pass through. */
export function rethrowUpstream(error: unknown): never {
    if (error instanceof MoneriumApiError) {
        throw upstreamUnavailable();
    }
    throw error;
}

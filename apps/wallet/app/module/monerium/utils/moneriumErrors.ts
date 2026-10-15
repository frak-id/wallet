import type { MoneriumErrorCode } from "@backend-domain/monerium/schemas";
import type { DefaultTranslationKey } from "@frak-labs/wallet-shared/types";

export type MoneriumError = Error & {
    /** Backend `code`, or null for network failures and local cancellations. */
    code: MoneriumErrorCode | null;
    status: number | null;
    cancelled: boolean;
};

/** Eden types `error` as `unknown` on undeclared status codes. */
type EdenResult<T> = { data: T | null; error: unknown };

function readField(source: unknown, key: string): unknown {
    return typeof source === "object" && source !== null && key in source
        ? (source as Record<string, unknown>)[key]
        : undefined;
}

const errorKeys: Record<MoneriumErrorCode, DefaultTranslationKey> = {
    MONERIUM_NOT_CONNECTED: "monerium.errors.notConnected",
    MONERIUM_REAUTH_REQUIRED: "monerium.errors.reauthRequired",
    MONERIUM_AUTH_STATE_INVALID: "monerium.errors.authStateInvalid",
    MONERIUM_TOKEN_EXCHANGE_FAILED: "monerium.errors.tokenExchangeFailed",
    MONERIUM_SIWE_REJECTED: "monerium.errors.siweRejected",
    MONERIUM_SIWE_UNAVAILABLE: "monerium.errors.siweUnavailable",
    MONERIUM_PROFILE_NOT_APPROVED: "monerium.errors.profileNotApproved",
    MONERIUM_LINK_REJECTED: "monerium.errors.linkRejected",
    MONERIUM_INVALID_AMOUNT: "monerium.errors.invalidAmount",
    MONERIUM_AMOUNT_LIMIT: "monerium.errors.amountLimit",
    MONERIUM_INVALID_IBAN: "monerium.errors.invalidIban",
    MONERIUM_INVALID_COUNTERPART: "monerium.errors.invalidCounterpart",
    MONERIUM_INVALID_MEMO: "monerium.errors.invalidMemo",
    MONERIUM_INVALID_MESSAGE: "monerium.errors.invalidMessage",
    MONERIUM_MESSAGE_EXPIRED: "monerium.errors.messageExpired",
    MONERIUM_WALLET_NOT_LINKED: "monerium.errors.walletNotLinked",
    MONERIUM_ORDER_REJECTED: "monerium.errors.orderRejected",
    MONERIUM_UPSTREAM_UNAVAILABLE: "monerium.errors.upstreamUnavailable",
};

const knownCodes = new Set<string>(Object.keys(errorKeys));

function readCode(value: unknown): MoneriumErrorCode | null {
    if (typeof value !== "object" || value === null || !("code" in value)) {
        return null;
    }
    const { code } = value;
    return typeof code === "string" && knownCodes.has(code)
        ? (code as MoneriumErrorCode)
        : null;
}

export function createMoneriumError(
    code: MoneriumErrorCode | null,
    options: { status?: number; cancelled?: boolean; cause?: unknown } = {}
): MoneriumError {
    return Object.assign(new Error(code ?? "MONERIUM_REQUEST_FAILED"), {
        code,
        status: options.status ?? null,
        cancelled: options.cancelled ?? false,
        cause: options.cause,
    });
}

/** Unwraps an Eden treaty result, throwing a `MoneriumError` carrying the backend code. */
export function unwrapMoneriumResponse<T>(response: EdenResult<T>): T {
    if (response.error) {
        const status = readField(response.error, "status");
        throw createMoneriumError(
            readCode(readField(response.error, "value")),
            {
                status: typeof status === "number" ? status : undefined,
            }
        );
    }
    if (response.data === null) {
        throw createMoneriumError(null);
    }
    return response.data;
}

const CANCELLED_NAMES = new Set([
    "NotAllowedError",
    "AbortError",
    "UserRejectedRequestError",
]);
const CANCELLED_MESSAGE = /reject|cancel|denied|not allowed|aborted/i;

/** A dismissed passkey or wallet prompt, as opposed to a failed request. */
export function isUserCancelledError(error: unknown): boolean {
    if (isMoneriumError(error)) return error.cancelled;
    if (!(error instanceof Error)) return false;
    return (
        CANCELLED_NAMES.has(error.name) ||
        CANCELLED_MESSAGE.test(error.message) ||
        (error.cause !== undefined && isUserCancelledError(error.cause))
    );
}

function isMoneriumError(error: unknown): error is MoneriumError {
    return (
        error instanceof Error &&
        "code" in error &&
        "cancelled" in error &&
        "status" in error
    );
}

export function getMoneriumErrorCode(error: unknown): MoneriumErrorCode | null {
    return isMoneriumError(error) ? error.code : null;
}

/** The single place where a failure becomes user-facing copy. */
export function getMoneriumErrorKey(error: unknown): DefaultTranslationKey {
    if (isUserCancelledError(error)) return "monerium.errors.cancelled";
    const code = getMoneriumErrorCode(error);
    if (code) return errorKeys[code];
    if (isMoneriumError(error) && (error.status ?? 0) >= 500) {
        return "monerium.errors.network";
    }
    return "monerium.errors.generic";
}

/** Retrying only helps when the request never got a definitive answer. */
export function isMoneriumRetryable(error: unknown): boolean {
    const code = getMoneriumErrorCode(error);
    if (code) return code === "MONERIUM_UPSTREAM_UNAVAILABLE";
    return !isMoneriumError(error) || (error.status ?? 0) >= 500;
}

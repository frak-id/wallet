/**
 * Monerium rules shared by the backend (which validates and places orders)
 * and the wallet (which builds the message the user signs). Both sides must
 * agree byte for byte on the redeem message, so it is only built here.
 */

export const MONERIUM_ADDRESS_LINKING_MESSAGE =
    "I hereby declare that I am the address owner.";

export const MONERIUM_DEFAULT_MEMO = "Frak Wallet offramp";

export const MONERIUM_LIMITS = {
    /** Personal third-party payouts at or above this need a supporting document, which we do not upload. */
    THIRD_PARTY_DOCUMENT_THRESHOLD_EUR: 15_000,
    MEMO_MIN_LENGTH: 5,
    MEMO_MAX_LENGTH: 140,
    NAME_MIN_LENGTH: 2,
    /** Monerium rejects a message timestamp older than 5 minutes but accepts any future one. */
    MESSAGE_MAX_AGE_MS: 5 * 60_000,
    /** Signing slightly ahead absorbs the passkey prompt and network latency. */
    MESSAGE_FUTURE_OFFSET_MS: 2 * 60_000,
    /** Upper bound we accept server-side, so a signed message cannot be replayed for days. */
    MESSAGE_MAX_FUTURE_MS: 10 * 60_000,
} as const;

export type MoneriumProfileState =
    | "created"
    | "incomplete"
    | "pending"
    | "review"
    | "approved"
    | "rejected"
    | "closed";

export type MoneriumProfileKind = "personal" | "corporate";

export type MoneriumEnvironment = "sandbox" | "production";

/** Sandbox never reviews identities: its profiles stay pending, yet can link wallets and pay out. */
export function isMoneriumProfileUsable(
    state: MoneriumProfileState | null | undefined,
    environment: MoneriumEnvironment
): boolean {
    if (!state || state === "rejected" || state === "closed") return false;
    return state === "approved" || environment === "sandbox";
}

/** An own payout reuses the profile's approved identity: a profile still under review cannot make one. */
export function isMoneriumOwnPayoutAvailable(
    state: MoneriumProfileState | null | undefined
): boolean {
    return state === "approved";
}

export type MoneriumOrderState =
    | "placed"
    | "pending"
    | "processed"
    | "rejected";

const IBAN_FORMAT = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
const AMOUNT_FORMAT = /^\d+(\.\d{1,2})?$/;
const COUNTRY_FORMAT = /^[A-Z]{2}$/;
const REDEEM_MESSAGE_FORMAT =
    /^Send EUR (\d+(?:\.\d{1,2})?) to ([A-Z0-9.]+) at (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)$/;

export function normalizeIban(iban: string): string {
    return iban.replace(/\s/g, "").toUpperCase();
}

/** Format check plus the ISO 13616 mod-97 checksum. */
export function isValidIban(iban: string): boolean {
    const normalized = normalizeIban(iban);
    if (!IBAN_FORMAT.test(normalized)) return false;
    const rearranged = normalized.slice(4) + normalized.slice(0, 4);
    let remainder = 0;
    for (const char of rearranged) {
        const value = Number.parseInt(char, 36);
        remainder =
            value >= 10
                ? (remainder * 100 + value) % 97
                : (remainder * 10 + value) % 97;
    }
    return remainder === 1;
}

/** Country of the bank holding the IBAN, a sensible default for the beneficiary country. */
export function getIbanCountry(iban: string): string | null {
    const normalized = normalizeIban(iban);
    return IBAN_FORMAT.test(normalized) ? normalized.slice(0, 2) : null;
}

/** Monerium's shortened IBAN form: first 4 and last 4 characters, always 11 chars. */
export function shortenIban(iban: string): string {
    const cleaned = normalizeIban(iban);
    if (cleaned.length <= 11) return cleaned;
    return `${cleaned.slice(0, 4)}...${cleaned.slice(-4)}`;
}

/** Accepts `12,5` from a keypad and returns Monerium's `12.5`, or null when invalid. */
export function normalizeRedeemAmount(input: string): string | null {
    const candidate = input.trim().replace(",", ".");
    if (!AMOUNT_FORMAT.test(candidate)) return null;
    if (Number.parseFloat(candidate) < 0.01) return null;
    return candidate;
}

export function isValidCountryCode(code: string): boolean {
    return COUNTRY_FORMAT.test(code);
}

export function isValidCounterpartName(name: string): boolean {
    return name.trim().length >= MONERIUM_LIMITS.NAME_MIN_LENGTH;
}

/** A third party can only be paid with both names; an own payout reuses the profile's identity. */
export function isPayableCounterpart(counterpart: {
    own: boolean;
    firstName?: string;
    lastName?: string;
}): boolean {
    return (
        counterpart.own ||
        (isValidCounterpartName(counterpart.firstName ?? "") &&
            isValidCounterpartName(counterpart.lastName ?? ""))
    );
}

/** The document threshold binds personal third-party payouts only; corporate profiles are exempt. */
export function exceedsThirdPartyLimit(
    amount: string,
    payout: {
        own: boolean;
        profileKind: MoneriumProfileKind | null | undefined;
    }
): boolean {
    const normalized = normalizeRedeemAmount(amount);
    return (
        normalized !== null &&
        !payout.own &&
        payout.profileKind !== "corporate" &&
        Number.parseFloat(normalized) >=
            MONERIUM_LIMITS.THIRD_PARTY_DOCUMENT_THRESHOLD_EUR
    );
}

export function isValidMemo(memo: string): boolean {
    const length = memo.trim().length;
    return (
        length >= MONERIUM_LIMITS.MEMO_MIN_LENGTH &&
        length <= MONERIUM_LIMITS.MEMO_MAX_LENGTH
    );
}

/** RFC 3339 in UTC, truncated to the minute: `2024-07-12T12:02:00Z`. */
export function formatMessageTimestamp(date: Date): string {
    return date.toISOString().replace(/:\d{2}\.\d{3}Z$/, ":00Z");
}

export function buildRedeemOrderMessage(params: {
    amount: string;
    iban: string;
    at: Date;
}): string {
    return `Send EUR ${params.amount} to ${shortenIban(params.iban)} at ${formatMessageTimestamp(params.at)}`;
}

export function parseRedeemOrderMessage(
    message: string
): { amount: string; iban: string; timestamp: Date } | null {
    const match = REDEEM_MESSAGE_FORMAT.exec(message);
    if (!match) return null;
    const [, amount, iban, rawTimestamp] = match;
    const timestamp = new Date(rawTimestamp);
    if (Number.isNaN(timestamp.getTime())) return null;
    return { amount, iban, timestamp };
}

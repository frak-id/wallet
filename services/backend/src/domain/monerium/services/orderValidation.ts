import { HttpError } from "@backend-utils";
import {
    exceedsThirdPartyLimit,
    isValidCounterpartName,
    isValidCountryCode,
    isValidIban,
    isValidMemo,
    MONERIUM_DEFAULT_MEMO,
    MONERIUM_LIMITS,
    type MoneriumProfileKind,
    normalizeIban,
    normalizeRedeemAmount,
    parseRedeemOrderMessage,
    shortenIban,
} from "@frak-labs/app-essentials/monerium";
import {
    type MoneriumErrorCode,
    type MoneriumPlaceOrderBody,
    moneriumErrorCodes,
} from "../schemas";

type ValidatedRedeemOrder = {
    amount: string;
    iban: string;
    memo: string;
    own: boolean;
    details:
        | { own: true }
        | { firstName: string; lastName: string; country: string };
};

function reject(code: MoneriumErrorCode, message: string): HttpError {
    return HttpError.unprocessable(code, message);
}

function resolveMemo(memo: string | undefined): string {
    if (memo === undefined || memo.trim() === "") return MONERIUM_DEFAULT_MEMO;
    if (!isValidMemo(memo)) {
        throw reject(
            moneriumErrorCodes.invalidMemo,
            `The memo must be ${MONERIUM_LIMITS.MEMO_MIN_LENGTH} to ${MONERIUM_LIMITS.MEMO_MAX_LENGTH} characters`
        );
    }
    return memo.trim();
}

function resolveDetails(
    counterpart: MoneriumPlaceOrderBody["counterpart"]
): ValidatedRedeemOrder["details"] {
    if (counterpart.own) return { own: true };
    const country = counterpart.country.trim().toUpperCase();
    if (
        !isValidCounterpartName(counterpart.firstName) ||
        !isValidCounterpartName(counterpart.lastName) ||
        !isValidCountryCode(country)
    ) {
        throw reject(
            moneriumErrorCodes.invalidCounterpart,
            "The beneficiary needs a first name, a last name and a two-letter country"
        );
    }
    return {
        firstName: counterpart.firstName.trim(),
        lastName: counterpart.lastName.trim(),
        country,
    };
}

/** Checks the signed message against the body: what the user signed must be what we forward. */
function assertMessageMatches(
    body: MoneriumPlaceOrderBody,
    amount: string,
    iban: string,
    now: Date
): void {
    const parsed = parseRedeemOrderMessage(body.message);
    if (
        !parsed ||
        parsed.amount !== amount ||
        shortenIban(parsed.iban) !== shortenIban(iban)
    ) {
        throw reject(
            moneriumErrorCodes.invalidMessage,
            "The signed message does not match the order"
        );
    }
    const ageMs = now.getTime() - parsed.timestamp.getTime();
    if (
        ageMs > MONERIUM_LIMITS.MESSAGE_MAX_AGE_MS ||
        -ageMs > MONERIUM_LIMITS.MESSAGE_MAX_FUTURE_MS
    ) {
        throw reject(
            moneriumErrorCodes.messageExpired,
            "The signed message is outside its validity window"
        );
    }
}

export function validateRedeemOrder(
    body: MoneriumPlaceOrderBody,
    now: Date,
    profileKind: MoneriumProfileKind | null
): ValidatedRedeemOrder {
    const amount = normalizeRedeemAmount(body.amount);
    if (!amount) {
        throw reject(moneriumErrorCodes.invalidAmount, "Invalid amount");
    }
    if (
        exceedsThirdPartyLimit(amount, {
            own: body.counterpart.own,
            profileKind,
        })
    ) {
        throw reject(
            moneriumErrorCodes.amountLimit,
            `Payouts to someone else are limited to under ${MONERIUM_LIMITS.THIRD_PARTY_DOCUMENT_THRESHOLD_EUR} EUR`
        );
    }
    if (!isValidIban(body.iban)) {
        throw reject(moneriumErrorCodes.invalidIban, "Invalid IBAN");
    }
    const iban = normalizeIban(body.iban);
    const details = resolveDetails(body.counterpart);
    const memo = resolveMemo(body.memo);
    assertMessageMatches(body, amount, iban, now);

    return { amount, iban, memo, own: body.counterpart.own, details };
}

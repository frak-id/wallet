import type { ConnectSubscriptionResult } from "app/services.server/subscriptions";

const MIN_TOKEN_LENGTH = 8;
const MAX_TOKEN_LENGTH = 512;

/** Same bounds the backend enforces on the trimmed token. */
export function isTokenSubmittable(token: string): boolean {
    const length = token.trim().length;
    return length >= MIN_TOKEN_LENGTH && length <= MAX_TOKEN_LENGTH;
}

export function connectErrorKey(
    result: ConnectSubscriptionResult
): string | null {
    switch (result) {
        case "connected":
            return null;
        case "invalid_token":
            return "subscriptions.errors.invalidToken";
        case "webhook_missing":
            return "subscriptions.errors.webhookMissing";
        case "unavailable":
            return "subscriptions.errors.unavailable";
        case "failed":
            return "subscriptions.errors.failed";
    }
}

/** UTC on purpose: the server render and the browser must print the same text. */
export function formatErrorDate(at: string, locale: string): string | null {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
    }).format(date);
}

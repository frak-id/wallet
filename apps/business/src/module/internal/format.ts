import type { TicketSource } from "@frak-labs/backend-elysia/domain/game/schemas";
import type { TFunction } from "i18next";
import { extractAuthErrorMessage } from "@/module/auth/utils/authError";
import {
    getDateTimeFormat,
    getNumberFormat,
} from "@/module/common/utils/intlCache";

type DateLike = Date | string | null | undefined;

export function toDate(value: DateLike): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: DateLike, locale: string): string {
    const date = toDate(value);
    if (!date) return "—";
    return getDateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export function formatEur(amount: number, locale: string): string {
    return getNumberFormat(locale, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
    }).format(amount);
}

export function formatCount(value: number, locale: string): string {
    return getNumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/** `0x1234…abcd`: enough to tell two values apart in a table. */
export function shortId(value: string, start = 6, end = 4): string {
    return value.length <= start + end + 1
        ? value
        : `${value.slice(0, start)}…${value.slice(-end)}`;
}

export function errorMessage(error: unknown, t: TFunction): string {
    return extractAuthErrorMessage(error, t("internal.errors.generic"));
}

export type GamePhase = "upcoming" | "live" | "ended" | "paused";

export function gamePhase(
    game: { status: string; startsAt: DateLike; endsAt: DateLike },
    now = Date.now()
): GamePhase {
    if ((toDate(game.endsAt)?.getTime() ?? 0) <= now) return "ended";
    if (game.status === "paused") return "paused";
    return (toDate(game.startsAt)?.getTime() ?? 0) > now ? "upcoming" : "live";
}

export const TICKET_SOURCES = [
    "join",
    "instagramCertified",
    "purchase",
    "referredPurchase",
    "referredSignup",
    "brandShare",
] as const satisfies readonly TicketSource[];

/** Only the sources that earned something, `2 join · 6 purchase`. */
export function ticketBreakdown(
    tickets: Record<TicketSource, number>,
    t: TFunction
): string {
    return TICKET_SOURCES.filter((source) => tickets[source] > 0)
        .map(
            (source) => `${tickets[source]} ${t(`internal.tickets.${source}`)}`
        )
        .join(" · ");
}

/** The wallet URL a Frak code's QR opens, uppercase so the QR uses its dense alphanumeric mode. */
export function frakCodeUrl(code: string): string {
    const walletUrl = process.env.FRAK_WALLET_URL ?? "https://wallet.frak.id";
    return `${walletUrl}/r/${code}`.toUpperCase();
}

import { createHmac } from "node:crypto";
import {
    CODE_ALPHABET,
    CODE_LENGTH,
    constantTimeStringEqual,
} from "@backend-utils";
import type {
    InstagramDeclarationSelect,
    InstagramLinkSelect,
    InstagramPendingLinkSelect,
} from "./db/schema";
import type {
    InstagramDeclaration,
    InstagramLevel,
    InstagramLink,
} from "./schemas";

const HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/;

/** The declaration a pending row carries; `null` when it only holds a code. */
export function toDeclarationRow(
    row: InstagramPendingLinkSelect
): InstagramDeclarationSelect | null {
    if (row.username === null || row.declaredAt === null) return null;
    return {
        id: row.id,
        identityGroupId: row.identityGroupId,
        username: row.username,
        declaredAt: row.declaredAt,
    };
}

/** Instagram handles are case-insensitive; `null` when `raw` cannot be one. */
export function normalizeInstagramHandle(raw: string): string | null {
    const handle = raw.trim().replace(/^@/, "").toLowerCase();
    return HANDLE_PATTERN.test(handle) ? handle : null;
}

export function toInstagramLink(row: InstagramLinkSelect): InstagramLink {
    return {
        username: row.username,
        follows: row.follows,
        checkedAt: row.checkedAt,
    };
}

type MergeableLink = Pick<
    InstagramLinkSelect,
    "id" | "identityGroupId" | "follows" | "checkedAt"
>;

/** The link a merged identity keeps: a follower beats a non-follower, then the anchor's own, then the freshest check. */
export function pickSurvivingLink<T extends MergeableLink>(
    links: T[],
    anchorGroupId: string
): T | null {
    const isAnchor = (link: T) =>
        Number(link.identityGroupId === anchorGroupId);
    const sorted = [...links].sort(
        (a, b) =>
            Number(b.follows) - Number(a.follows) ||
            isAnchor(b) - isAnchor(a) ||
            b.checkedAt.getTime() - a.checkedAt.getTime() ||
            a.id.localeCompare(b.id)
    );
    return sorted[0] ?? null;
}

/** The declaration a merged identity keeps: the anchor's own, then the latest. */
export function pickSurvivingDeclaration<
    T extends Pick<
        InstagramDeclarationSelect,
        "id" | "identityGroupId" | "declaredAt"
    >,
>(declarations: T[], anchorGroupId: string): T | null {
    const isAnchor = (row: T) => Number(row.identityGroupId === anchorGroupId);
    const sorted = [...declarations].sort(
        (a, b) =>
            isAnchor(b) - isAnchor(a) ||
            b.declaredAt.getTime() - a.declaredAt.getTime() ||
            a.id.localeCompare(b.id)
    );
    return sorted[0] ?? null;
}

export function toInstagramDeclaration(
    row: InstagramDeclarationSelect
): InstagramDeclaration {
    return { username: row.username, declaredAt: row.declaredAt };
}

/** A certified link wins over a declaration; certifying deletes the declaration anyway. */
export function instagramLevelOf(
    link: unknown | null,
    declaration: unknown | null
): InstagramLevel {
    if (link) return "certified";
    return declaration ? "declared" : "none";
}

/** Counts in the draw: certified and following, or declared (checked only if drawn). */
export function isDrawEligible(
    link: Pick<InstagramLinkSelect, "follows"> | null,
    declaration: unknown | null
): boolean {
    if (link) return link.follows;
    return declaration !== null;
}

/** What a winner must be to get paid, and what unlocks money: certified and following. */
export function isVerifiedFollower(
    link: Pick<InstagramLinkSelect, "follows"> | null
): boolean {
    return link?.follows === true;
}

const CODE_CANDIDATE = new RegExp(
    `(?<![A-Z0-9])[${CODE_ALPHABET}]{${CODE_LENGTH}}(?![A-Z0-9])`,
    "g"
);
const MAX_CODE_CANDIDATES = 10;

/** Every word of a DM that could be a link code, case-insensitive, in order. */
export function extractCodeCandidates(text: string): string[] {
    const found = text.toUpperCase().match(CODE_CANDIDATE) ?? [];
    return [...new Set(found)].slice(0, MAX_CODE_CANDIDATES);
}

/** `X-Hub-Signature-256` is `sha256=<hex>` of the raw body, keyed by the Instagram app secret. */
export function isValidMetaSignature(
    rawBody: string,
    header: string | undefined,
    appSecret: string
): boolean {
    if (!header?.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", appSecret)
        .update(rawBody, "utf8")
        .digest("hex");
    return constantTimeStringEqual(
        header.slice("sha256=".length).toLowerCase(),
        expected
    );
}

export type IncomingInstagramMessage = { igsid: string; text: string };

type MessagingItem = {
    sender?: { id?: string };
    message?: { text?: string; is_echo?: boolean };
};

/** Text DMs from players: our own echoes, referrals, reactions and attachments are dropped. */
export function extractTextMessages(
    payload: unknown
): IncomingInstagramMessage[] {
    const { object, entry } = (payload ?? {}) as {
        object?: string;
        entry?: { id?: string; messaging?: MessagingItem[] }[];
    };
    if (object !== "instagram" || !Array.isArray(entry)) return [];
    return entry.flatMap((item) =>
        (Array.isArray(item.messaging) ? item.messaging : []).flatMap(
            ({ sender, message }) => {
                const igsid = sender?.id;
                const text = message?.text;
                if (!(igsid && text) || message?.is_echo) return [];
                if (igsid === item.id) return [];
                return [{ igsid, text }];
            }
        )
    );
}

import type { InstagramLinkSelect } from "./db/schema";
import type { InstagramLink } from "./schemas";

const HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/;

/** Instagram handles are case-insensitive; `null` when `raw` cannot be one. */
export function normalizeInstagramHandle(raw: string): string | null {
    const handle = raw.trim().replace(/^@/, "").toLowerCase();
    return HANDLE_PATTERN.test(handle) ? handle : null;
}

/** Prefix of every IGSID the mock mints, so those rows are told apart from Meta's and purged. */
export const MOCK_IGSID_PREFIX = "mock_";

export function mockIgsidOf(handle: string): string {
    return `${MOCK_IGSID_PREFIX}${handle}`;
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

/** Eligible for the draw = linked AND following; a missing link is not eligible. */
export function isInstagramEligible(
    link: Pick<InstagramLinkSelect, "follows"> | null
): boolean {
    return link?.follows === true;
}

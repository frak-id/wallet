/**
 * Sections whose URL has no merchant-specific resource id in it — safe
 * to carry over to another merchant. Anything else (campaign details,
 * drafts, edit screens) targets a resource that belongs to the source
 * merchant and would 404 under the new one, so we fall back to the
 * dashboard.
 */
const SAFE_SECTIONS = [
    "/dashboard",
    "/campaigns",
    "/campaigns/list",
    "/members",
    "/merchant",
    "/merchant/funding",
    "/merchant/customize",
    "/merchant/team",
    "/merchant/setup-status",
    // `/push/*` is intentionally *not* listed: the push composition lives
    // in `pushCreationStore` and isn't merchant-scoped, so carrying it
    // across merchants would silently re-target a draft. Switching from
    // there falls back to the merchant dashboard.
];

/**
 * Map the current URL to the equivalent path under a different merchant
 * so switching preserves the section the user is in
 * (e.g. `/m/A/campaigns/list` → `/m/B/campaigns/list`).
 */
export function buildSwitchTarget(
    pathname: string,
    merchantId: string
): string {
    const match = pathname.match(/^\/m\/[^/]+(\/.*)?$/);
    const tail = match?.[1] ?? "/dashboard";
    const safe = SAFE_SECTIONS.includes(tail) ? tail : "/dashboard";
    return `/m/${merchantId}${safe}`;
}

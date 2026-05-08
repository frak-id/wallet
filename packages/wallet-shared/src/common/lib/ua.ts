/**
 * Lightweight mobile-device detection.
 *
 * Replaces `ua-parser-js`'s `getDevice().type === "mobile"` check, which
 * pulled the full parser (~12 KB gzip) into the bundle just to read a single
 * boolean.
 *
 * Strategy mirrors UAParser v2.0.9:
 *   1. Prefer `navigator.userAgentData.mobile` (User-Agent Client Hints)
 *      when available — Chromium exposes it natively as a boolean and the
 *      classic UA string is being frozen there. UAParser uses the same
 *      signal first (`src/main/ua-parser.mjs:1243`).
 *   2. Fall back to UAParser's catch-all "unidentifiable mobile" regex
 *      (`src/main/ua-parser.mjs:932`). It catches iPhone/iPod (via `phone`),
 *      Android Mobile + WebView (via `Mobile Safari` / `Mobile;` / `Mobile/`),
 *      Windows Phone / IEMobile, and Windows CE PDAs. iPads are intentionally
 *      not matched — UAParser classifies them as tablet, not mobile.
 *
 * Edge cases not covered (require UAParser's vendor tables): BlackBerry and
 * a few exotic Asian-market brands without a `Mobile` token. No current call
 * site depends on those.
 */

const MOBILE_UA_REGEX =
    /(phone|mobile(?:[;/]| [ \w/.]*safari)|pda(?=.+windows ce))/i;

type NavigatorWithUaData = Navigator & {
    userAgentData?: { mobile?: boolean };
};

function detectIsMobile(): boolean {
    if (typeof navigator === "undefined") return false;
    const uaData = (navigator as NavigatorWithUaData).userAgentData;
    if (typeof uaData?.mobile === "boolean") return uaData.mobile;
    return MOBILE_UA_REGEX.test(navigator.userAgent);
}

/**
 * Coarse user-agent flags evaluated once at module load.
 */
export const ua = {
    isMobile: detectIsMobile(),
};

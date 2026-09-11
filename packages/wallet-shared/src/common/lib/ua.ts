/**
 * Lightweight mobile-device detection, ported from UAParser v2.0.9 so the
 * full parser (~12 KB gzip) stays out of the bundle. iPads do not match —
 * UAParser classifies them as tablet. BlackBerry and a few Asian-market
 * brands without a `Mobile` token need the vendor tables and are missed.
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

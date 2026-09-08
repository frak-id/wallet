/**
 * Order is load-bearing: Edge, Opera and Samsung Internet all carry `Chrome/`,
 * and every Chromium-derived UA also carries `Safari/`, so the most specific
 * token has to win. iOS variants (`CriOS`, `FxiOS`, `EdgiOS`) name the engine
 * they wrap, not the one they run on.
 */
const BROWSERS: readonly (readonly [RegExp, string])[] = [
    [/\bEdg(?:e|A|iOS)?\//, "Edge"],
    [/\bOPR\/|\bOpera[\s/]/, "Opera"],
    [/\bSamsungBrowser\//, "Samsung Internet"],
    [/\bFirefox\/|\bFxiOS\//, "Firefox"],
    [/\bChrome\/|\bCriOS\//, "Chrome"],
    [/\bSafari\//, "Safari"],
];

const OPERATING_SYSTEMS: readonly (readonly [RegExp, string])[] = [
    [/\biPhone\b|\biPad\b|\biPod\b/, "iOS"],
    [/\bAndroid\b/, "Android"],
    [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
    [/\bWindows\b/, "Windows"],
    [/\bCrOS\b/, "ChromeOS"],
    [/\bLinux\b/, "Linux"],
];

function match(
    table: readonly (readonly [RegExp, string])[],
    userAgent: string
): string | null {
    for (const [pattern, name] of table) {
        if (pattern.test(userAgent)) return name;
    }
    return null;
}

/**
 * Human-readable device label for a pairing session, e.g. `"Chrome on iOS"`.
 * Cosmetic only — it is shown next to a pairing request, never used to gate
 * behaviour, so an unrecognised agent degrades rather than throwing.
 */
export function describeUserAgent(userAgent?: string): string {
    if (!userAgent) return "Unknown device";
    const browser = match(BROWSERS, userAgent);
    const os = match(OPERATING_SYSTEMS, userAgent);
    if (browser && os) return `${browser} on ${os}`;
    return browser ?? os ?? "Unknown device";
}

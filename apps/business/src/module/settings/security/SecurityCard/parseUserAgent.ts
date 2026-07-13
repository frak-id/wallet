/**
 * Best-effort, dependency-free user-agent summary for the sessions list —
 * turns a raw UA string into "OS · Browser" plus a coarse form factor for
 * the device icon. Not exhaustive; unknown parts are simply dropped.
 */
type ParsedUserAgent = {
    label: string;
    isMobile: boolean;
};

export function parseUserAgent(
    userAgent: string | null | undefined
): ParsedUserAgent {
    if (!userAgent) return { label: "—", isMobile: false };

    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);

    const os = matchFirst(userAgent, [
        [/Windows/i, "Windows"],
        [/iPhone|iPad|iPod/i, "iOS"],
        [/Mac OS X|Macintosh/i, "macOS"],
        [/Android/i, "Android"],
        [/Linux/i, "Linux"],
    ]);

    const browser = matchFirst(userAgent, [
        [/Edg\//i, "Edge"],
        [/OPR\/|Opera/i, "Opera"],
        [/Chrome\//i, "Chrome"],
        [/Firefox\//i, "Firefox"],
        [/Safari\//i, "Safari"],
    ]);

    const label = [os, browser].filter(Boolean).join(" · ");
    return { label: label || userAgent, isMobile };
}

function matchFirst(
    input: string,
    table: readonly [RegExp, string][]
): string | undefined {
    for (const [pattern, value] of table) {
        if (pattern.test(input)) return value;
    }
    return undefined;
}

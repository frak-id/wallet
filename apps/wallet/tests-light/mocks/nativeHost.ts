import type { Page } from "@playwright/test";

/** Custom-scheme prefix the specs hand to the page as `returnScheme`. */
export const RETURN_SCHEME = "frak-test";

/**
 * Record the outcomes the page hands to a native host.
 *
 * These are `<scheme>://result?action=…` navigations. Chromium hands the
 * unknown scheme to the OS and never resolves the request, so specs must
 * navigate with `waitUntil: "commit"`; `page.route` never sees them either,
 * since it only handles http/https.
 */
export function recordHostResults(page: Page): string[] {
    const results: string[] = [];

    // Both events fire for one navigation, so `framenavigated` is only a
    // duplicate when `request` already recorded that exact URL for the same
    // navigation. Deduping by value instead would swallow a real second press:
    // `share` and `copy` are repeatable and produce identical URLs.
    let lastRequested: string | null = null;

    page.on("request", (request) => {
        const url = request.url();
        if (!url.startsWith(`${RETURN_SCHEME}://`)) return;
        lastRequested = url;
        results.push(url);
    });

    page.on("framenavigated", (frame) => {
        const url = frame.url();
        if (!url.startsWith(`${RETURN_SCHEME}://`)) return;
        if (url === lastRequested) {
            lastRequested = null;
            return;
        }
        results.push(url);
    });

    return results;
}

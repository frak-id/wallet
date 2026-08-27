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

    // `request` and `framenavigated` both fire for one navigation. Only the
    // immediate repeat is that pair — `share` and `copy` are genuinely
    // repeatable, so an identical URL later is a real second press.
    const capture = (url: string) => {
        if (url.startsWith(`${RETURN_SCHEME}://`) && results.at(-1) !== url) {
            results.push(url);
        }
    };

    page.on("request", (request) => capture(request.url()));
    page.on("framenavigated", (frame) => capture(frame.url()));

    return results;
}

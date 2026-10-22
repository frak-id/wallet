import { afterEach, describe, expect, test, vi } from "vitest";

const IG_IOS_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 424.0.0.0.0";
const FB_IOS_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0]";
const IG_ANDROID_UA =
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 Instagram 424.0.0.0.0 Android";

async function loadWithUserAgent(userAgent: string) {
    vi.resetModules();
    Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: userAgent,
    });
    Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: { href: "https://wallet.frak.id/install?ref=TEST02" },
    });
    return import("./inAppBrowser");
}

describe("redirectToExternalBrowser", () => {
    afterEach(() => {
        vi.resetModules();
    });

    test("uses Instagram's own scheme inside Instagram on iOS", async () => {
        const { redirectToExternalBrowser, isInstagramBrowser } =
            await loadWithUserAgent(IG_IOS_UA);
        expect(isInstagramBrowser).toBe(true);

        redirectToExternalBrowser("https://wallet.frak.id/install?ref=TEST02");

        expect(window.location.href).toBe(
            "instagram://extbrowser/?url=https%3A%2F%2Fwallet.frak.id%2Finstall%3Fref%3DTEST02"
        );
    });

    test("keeps x-safari-https inside Facebook on iOS", async () => {
        const { redirectToExternalBrowser } =
            await loadWithUserAgent(FB_IOS_UA);

        redirectToExternalBrowser("https://shop.example.com/p?a=1");

        expect(window.location.href).toBe(
            "x-safari-https://shop.example.com/p?a=1"
        );
    });

    test("keeps the backend hand-off inside Instagram on Android", async () => {
        const { redirectToExternalBrowser } =
            await loadWithUserAgent(IG_ANDROID_UA);

        redirectToExternalBrowser("https://shop.example.com/p");

        expect(window.location.href).toMatch(
            /\/common\/social\?u=https%3A%2F%2Fshop\.example\.com%2Fp$/
        );
    });
});

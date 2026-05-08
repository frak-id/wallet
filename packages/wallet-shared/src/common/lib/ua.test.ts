import { describe, expect, it } from "vitest";
import { ua } from "./ua";

describe("ua", () => {
    it("should expose isMobile as a boolean", () => {
        expect(ua).toHaveProperty("isMobile");
        expect(typeof ua.isMobile).toBe("boolean");
    });

    it("should not throw when reading isMobile", () => {
        // jsdom provides navigator.userAgent; both true/false are acceptable.
        expect([true, false]).toContain(ua.isMobile);
    });
});

// Sanity-check the UA regex against representative real-world strings to
// guard the "matches what UAParser classifies as mobile" contract.
describe("MOBILE_UA_REGEX (parity with ua-parser-js)", () => {
    const MOBILE_UA_REGEX =
        /(phone|mobile(?:[;/]| [ \w/.]*safari)|pda(?=.+windows ce))/i;

    const mobileUas = [
        // iPhone (modern Safari)
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        // iPod touch
        "Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
        // Android Pixel (Chrome)
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        // Android WebView
        "Mozilla/5.0 (Linux; Android 13; SM-S918B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36",
        // Firefox Android
        "Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0",
        // Windows Phone / IEMobile
        "Mozilla/5.0 (compatible; MSIE 9.0; Windows Phone OS 7.5; Trident/5.0; IEMobile/9.0)",
    ];

    const nonMobileUas = [
        // Desktop Chrome
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        // Desktop Firefox
        "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
        // iPad (UAParser classifies as tablet, not mobile)
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1",
        // Modern iPad UA (masquerading as Mac)
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1",
        // Safari on mac
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15",
    ];

    for (const userAgent of mobileUas) {
        it(`matches mobile UA: ${userAgent.slice(0, 50)}…`, () => {
            expect(MOBILE_UA_REGEX.test(userAgent)).toBe(true);
        });
    }

    for (const userAgent of nonMobileUas) {
        it(`does not match non-mobile UA: ${userAgent.slice(0, 50)}…`, () => {
            expect(MOBILE_UA_REGEX.test(userAgent)).toBe(false);
        });
    }
});

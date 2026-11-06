import { describe, expect, it } from "vitest";
import { getRewardCountdown, isStorageCappedBrowser } from "./countdown";

const NOW = Date.parse("2026-11-07T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(NOW + days * DAY).toISOString();

const SAFARI_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const CHROME_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const CHROME_ANDROID =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const FIREFOX_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0";

describe("isStorageCappedBrowser", () => {
    it("flags desktop Safari", () => {
        expect(isStorageCappedBrowser(SAFARI_MAC, false)).toBe(true);
    });

    it("flags every iOS browser, whatever its UA says", () => {
        expect(isStorageCappedBrowser(CHROME_MAC, true)).toBe(true);
    });

    it.each([
        ["Chrome on macOS", CHROME_MAC],
        ["Chrome on Android", CHROME_ANDROID],
        ["Firefox on macOS", FIREFOX_MAC],
    ])("leaves %s alone", (_, userAgent) => {
        expect(isStorageCappedBrowser(userAgent, false)).toBe(false);
    });
});

describe("getRewardCountdown", () => {
    it("counts whole days left, rounded up", () => {
        const countdown = getRewardCountdown(inDays(27.2), {
            now: NOW,
            capped: false,
        });
        expect(countdown?.days).toBe(28);
        expect(countdown?.date.toISOString()).toBe(inDays(27.2));
    });

    it("reports 0 once the deadline has passed", () => {
        expect(
            getRewardCountdown(inDays(-1), { now: NOW, capped: false })?.days
        ).toBe(0);
    });

    it("shows no countdown without a deadline outside WebKit", () => {
        expect(
            getRewardCountdown(null, { now: NOW, capped: false })
        ).toBeUndefined();
    });

    it("caps a far deadline at 7 days on WebKit", () => {
        const countdown = getRewardCountdown(inDays(40), {
            now: NOW,
            capped: true,
        });
        expect(countdown?.days).toBe(7);
        expect(countdown?.date.toISOString()).toBe(inDays(7));
    });

    it("keeps a nearer deadline on WebKit", () => {
        const countdown = getRewardCountdown(inDays(3), {
            now: NOW,
            capped: true,
        });
        expect(countdown?.days).toBe(3);
        expect(countdown?.date.toISOString()).toBe(inDays(3));
    });

    it("still counts down 7 days on WebKit without a deadline", () => {
        expect(getRewardCountdown(null, { now: NOW, capped: true })?.days).toBe(
            7
        );
    });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { getRewardDaysLeft } from "./rewardCountdown";

const NOW = Date.parse("2026-06-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const inMs = (ms: number) => new Date(NOW + ms).toISOString();

function useUserAgent(userAgent: string) {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
}

const CHROME =
    "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const SAFARI =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("getRewardDaysLeft", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("rounds the days up outside WebKit", () => {
        useUserAgent(CHROME);

        expect(getRewardDaysLeft(inMs(30 * DAY - 1000), NOW)).toBe(30);
        expect(getRewardDaysLeft(inMs(1000), NOW)).toBe(1);
    });

    it("is 0 once the deadline has passed", () => {
        useUserAgent(CHROME);

        expect(getRewardDaysLeft(inMs(-DAY), NOW)).toBe(0);
    });

    it("has no countdown without a deadline outside WebKit", () => {
        useUserAgent(CHROME);

        expect(getRewardDaysLeft(null, NOW)).toBeUndefined();
    });

    it("caps at 7 days on desktop Safari", () => {
        useUserAgent(SAFARI);

        expect(getRewardDaysLeft(inMs(60 * DAY), NOW)).toBe(7);
        expect(getRewardDaysLeft(inMs(3 * DAY - 1000), NOW)).toBe(3);
    });

    it("shows 7 days on Safari when there is no deadline", () => {
        useUserAgent(SAFARI);

        expect(getRewardDaysLeft(null, NOW)).toBe(7);
    });
});

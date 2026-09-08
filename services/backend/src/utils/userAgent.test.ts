import { describe, expect, it } from "vitest";
import { describeUserAgent } from "./userAgent";

const AGENTS: [label: string, ua: string, expected: string][] = [
    [
        "chrome on windows",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        "Chrome on Windows",
    ],
    [
        "safari on ios",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
        "Safari on iOS",
    ],
    [
        "chrome on ios reports CriOS, not Safari",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1",
        "Chrome on iOS",
    ],
    [
        "firefox on ios reports FxiOS, not Safari",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15",
        "Firefox on iOS",
    ],
    [
        "edge beats the Chrome and Safari tokens it carries",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
        "Edge on Windows",
    ],
    [
        "opera beats the Chrome and Safari tokens it carries",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/119.0.0.0",
        "Opera on macOS",
    ],
    [
        "samsung internet beats the Chrome token it carries",
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
        "Samsung Internet on Android",
    ],
    [
        "android beats the Linux token it carries",
        "Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
        "Chrome on Android",
    ],
    [
        "firefox on linux",
        "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
        "Firefox on Linux",
    ],
];

describe("describeUserAgent", () => {
    it.each(AGENTS)("%s", (_label, ua, expected) => {
        expect(describeUserAgent(ua)).toBe(expected);
    });

    it("falls back when the agent is missing or unrecognised", () => {
        expect(describeUserAgent(undefined)).toBe("Unknown device");
        expect(describeUserAgent("")).toBe("Unknown device");
        expect(describeUserAgent("curl/8.7.1")).toBe("Unknown device");
    });

    it("degrades to the half it can identify rather than naming undefined", () => {
        expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0)")).toBe(
            "Windows"
        );
        expect(describeUserAgent("Firefox/133.0")).toBe("Firefox");
    });
});

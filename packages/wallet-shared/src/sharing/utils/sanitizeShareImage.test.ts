import { describe, expect, it } from "vitest";
import { sanitizeShareImage } from "./sanitizeShareImage";

describe("sanitizeShareImage", () => {
    it("accepts a plain https URL", () => {
        expect(sanitizeShareImage("https://cdn.example.com/logo.png")).toBe(
            "https://cdn.example.com/logo.png"
        );
    });

    it("keeps the query string, unlike sanitizeRedirectUrl", () => {
        const url = "https://cdn.example.com/logo.png?sig=abc123&exp=999";
        expect(sanitizeShareImage(url)).toBe(url);
    });

    it("rejects non-https protocols", () => {
        expect(
            sanitizeShareImage("http://cdn.example.com/logo.png")
        ).toBeUndefined();
        expect(sanitizeShareImage("javascript:alert(1)")).toBeUndefined();
        expect(
            sanitizeShareImage("data:image/png;base64,AAAA")
        ).toBeUndefined();
    });

    it("rejects embedded credentials", () => {
        expect(
            sanitizeShareImage("https://user:pass@cdn.example.com/logo.png")
        ).toBeUndefined();
        expect(
            sanitizeShareImage("https://user@cdn.example.com/logo.png")
        ).toBeUndefined();
    });

    it("rejects values over the length cap", () => {
        const long = `https://cdn.example.com/${"a".repeat(500)}.png`;
        expect(long.length).toBeGreaterThan(512);
        expect(sanitizeShareImage(long)).toBeUndefined();
    });

    it("rejects private and loopback IPv4 targets", () => {
        for (const host of [
            "10.0.0.1",
            "127.0.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "172.16.0.1",
            "172.31.255.255",
            "0.0.0.0",
        ]) {
            expect(sanitizeShareImage(`https://${host}/x.png`)).toBeUndefined();
        }
    });

    it("allows public IPv4 either side of the 172.16/12 block", () => {
        for (const host of ["172.15.0.1", "172.32.0.1", "11.0.0.1"]) {
            expect(sanitizeShareImage(`https://${host}/x.png`)).toBe(
                `https://${host}/x.png`
            );
        }
    });

    it("rejects private IPv6 targets, including mapped IPv4", () => {
        for (const host of [
            "[::1]",
            "[fc00::1]",
            "[fd12:3456::1]",
            "[fe80::1]",
            "[::ffff:10.0.0.1]",
        ]) {
            expect(sanitizeShareImage(`https://${host}/x.png`)).toBeUndefined();
        }
    });

    it("rejects internal-only hostnames", () => {
        for (const host of [
            "localhost",
            "printer.local",
            "db.internal",
            "PRINTER.LOCAL",
        ]) {
            expect(sanitizeShareImage(`https://${host}/x.png`)).toBeUndefined();
        }
    });

    it("rejects malformed and non-string input", () => {
        expect(sanitizeShareImage("not a url")).toBeUndefined();
        expect(sanitizeShareImage(undefined)).toBeUndefined();
        expect(sanitizeShareImage(42)).toBeUndefined();
        expect(sanitizeShareImage("")).toBeUndefined();
    });
});

import { describe, expect, it } from "vitest";
import { isPublicHost } from "./isPublicHost";

describe("isPublicHost", () => {
    it("accepts ordinary public hosts", () => {
        for (const host of [
            "cdn.example.com",
            "example.co.uk",
            "8.8.8.8",
            "1.1.1.1",
        ]) {
            expect(isPublicHost(host)).toBe(true);
        }
    });

    it("rejects the RFC 1918 ranges and loopback", () => {
        for (const host of [
            "10.0.0.1",
            "10.255.255.255",
            "172.16.0.1",
            "172.31.255.255",
            "192.168.0.1",
            "127.0.0.1",
            "0.0.0.0",
        ]) {
            expect(isPublicHost(host)).toBe(false);
        }
    });

    it("accepts the octets either side of the 172.16/12 block", () => {
        expect(isPublicHost("172.15.255.255")).toBe(true);
        expect(isPublicHost("172.32.0.0")).toBe(true);
    });

    it("rejects link-local, which is how cloud metadata is reached", () => {
        expect(isPublicHost("169.254.169.254")).toBe(false);
    });

    it("rejects internal-only name suffixes, case-insensitively", () => {
        for (const host of [
            "localhost",
            "app.localhost",
            "printer.local",
            "PRINTER.LOCAL",
            "db.internal",
        ]) {
            expect(isPublicHost(host)).toBe(false);
        }
    });

    it("rejects single-label hosts, which resolve on the LAN", () => {
        // The exact targets the Tauri fetcher must not be pointed at: a search-domain
        // completion reaches the user's own network.
        for (const host of ["router", "intranet", "nas", "printer.home.arpa", "box.lan"]) {
            expect(isPublicHost(host)).toBe(false);
        }
        expect(isPublicHost("cdn.example.com")).toBe(true);
    });

    it("rejects private IPv6, bracketed or bare", () => {
        for (const host of [
            "::1",
            "[::1]",
            "::",
            "fc00::1",
            "[fd12:3456::1]",
            "fe80::1",
            "[feb0::1]",
        ]) {
            expect(isPublicHost(host)).toBe(false);
        }
    });

    it("rejects IPv4-mapped IPv6 in both dotted and hex form", () => {
        expect(isPublicHost("[::ffff:10.0.0.1]")).toBe(false);
        // What `URL` normalises the above to.
        expect(isPublicHost("[::ffff:a00:1]")).toBe(false);
        expect(isPublicHost("[::ffff:c0a8:1]")).toBe(false);
        expect(isPublicHost("[::ffff:8.8.8.8]")).toBe(true);
    });

    it("accepts public IPv6", () => {
        expect(isPublicHost("[2606:4700::1111]")).toBe(true);
    });

    it("rejects an empty host", () => {
        expect(isPublicHost("")).toBe(false);
    });
});

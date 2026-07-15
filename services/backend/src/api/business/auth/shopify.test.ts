import { describe, expect, it } from "vitest";
import { packState, safeRelativeRedirect, unpackState } from "./shopify";

describe("safeRelativeRedirect", () => {
    it("accepts single-slash relative paths", () => {
        expect(safeRelativeRedirect("/m/abc/dashboard")).toBe(
            "/m/abc/dashboard"
        );
        expect(safeRelativeRedirect("/campaigns/list")).toBe("/campaigns/list");
        expect(safeRelativeRedirect("/")).toBe("/");
    });

    it("rejects absent / empty values", () => {
        expect(safeRelativeRedirect(null)).toBeNull();
        expect(safeRelativeRedirect(undefined)).toBeNull();
        expect(safeRelativeRedirect("")).toBeNull();
    });

    it("rejects non-relative and open-redirect payloads", () => {
        expect(safeRelativeRedirect("https://evil.com")).toBeNull();
        expect(safeRelativeRedirect("//evil.com")).toBeNull();
        expect(safeRelativeRedirect("/\\evil.com")).toBeNull();
        expect(safeRelativeRedirect("/path\\with\\backslash")).toBeNull();
        expect(safeRelativeRedirect("relative/no-leading-slash")).toBeNull();
        expect(safeRelativeRedirect("javascript:alert(1)")).toBeNull();
    });
});

describe("packState / unpackState round-trip", () => {
    it("returns the bare nonce when there is no redirect", () => {
        expect(packState("nonce123", null)).toBe("nonce123");
        expect(unpackState("nonce123")).toEqual({
            nonce: "nonce123",
            redirect: null,
        });
    });

    it("round-trips a nonce + redirect through base64url", () => {
        const state = packState("nonce123", "/m/abc/dashboard");
        expect(state).toContain(".");
        expect(state.startsWith("nonce123.")).toBe(true);
        expect(unpackState(state)).toEqual({
            nonce: "nonce123",
            redirect: "/m/abc/dashboard",
        });
    });

    it("preserves the nonce even when the redirect payload is garbage", () => {
        // Tampered/invalid base64url still yields the correct nonce and a
        // null (rejected) redirect rather than throwing.
        const { nonce, redirect } = unpackState("nonce123.!!!not-base64!!!");
        expect(nonce).toBe("nonce123");
        expect(redirect).toBeNull();
    });

    it("re-validates the decoded redirect and drops open-redirect payloads", () => {
        // A base64url-encoded absolute URL survives decoding but must be
        // rejected by the re-validation in unpackState.
        const encoded = Buffer.from("https://evil.com", "utf8").toString(
            "base64url"
        );
        expect(unpackState(`nonce123.${encoded}`)).toEqual({
            nonce: "nonce123",
            redirect: null,
        });
    });

    it("splits on the first dot only", () => {
        const nonce = "abc";
        const encoded = Buffer.from("/m/x/dashboard", "utf8").toString(
            "base64url"
        );
        // Even if extra dots appear, only the first delimits the nonce.
        expect(unpackState(`${nonce}.${encoded}`).nonce).toBe(nonce);
    });
});

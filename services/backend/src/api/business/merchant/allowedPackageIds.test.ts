import { describe, expect, it } from "vitest";
import { normalizePackageId } from "../../../domain/merchant";

// Input validation lives in `@frak-labs/app-essentials` (isValidPackageId) and
// is covered by its own tests. What is backend-specific is the storage key.
describe("stored package key", () => {
    it("splits back into the platform and package id the dashboard renders", () => {
        const key = normalizePackageId(
            "57DZ6Z2235.com.groupeseb.MyMoulinex",
            "ios"
        );
        const separator = key.indexOf(":");

        expect(key.slice(0, separator)).toBe("ios");
        // Lowercased on write, so the dashboard shows the normalized form.
        expect(key.slice(separator + 1)).toBe(
            "57dz6z2235.com.groupeseb.mymoulinex"
        );
    });

    it("normalizes casing and padding, so one app cannot be claimed twice", () => {
        expect(normalizePackageId("  Com.Example.App ", "android")).toBe(
            normalizePackageId("com.example.app", "android")
        );
    });
});

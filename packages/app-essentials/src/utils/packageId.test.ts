import { describe, expect, it } from "vitest";
import { isValidPackageId, PACKAGE_ID_REGEX } from "./packageId";

describe("isValidPackageId", () => {
    it.each([
        "com.groupeseb.moulinex.food",
        "57DZ6Z2235.com.groupeseb.MyMoulinex",
        "com.my_company.my-app",
        "  com.example.app  ",
    ])("accepts %j", (packageId) => {
        expect(isValidPackageId(packageId)).toBe(true);
    });

    it.each([
        // A single bare word resolves to nothing.
        "moulinex",
        // A domain pasted into the app field.
        "https://moulinex.fr",
        "com..app",
        ".com.example",
        "com.example.",
        "com example.app",
        "",
        "   ",
        // Already prefixed: the storage key must never be double-prefixed.
        "android:com.example.app",
    ])("rejects %j", (packageId) => {
        expect(isValidPackageId(packageId)).toBe(false);
    });

    it("exposes the raw regex (no trimming or lowercasing) for callers that need it", () => {
        expect(PACKAGE_ID_REGEX.test("com.example.app")).toBe(true);
        expect(PACKAGE_ID_REGEX.test(" com.example.app ")).toBe(false);
        expect(PACKAGE_ID_REGEX.test("com.Example.App")).toBe(false);
    });
});

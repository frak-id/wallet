import { describe, expect, it } from "vitest";
import { compareVersions, isBelow } from "./compareVersions";

describe("compareVersions", () => {
    it("returns 0 for identical versions", () => {
        expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    });

    it("returns -1 when first is strictly lower (patch)", () => {
        expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
    });

    it("returns 1 when first is strictly higher (patch)", () => {
        expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
    });

    it("compares minor numerically (10 > 9)", () => {
        expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    });

    it("compares major numerically", () => {
        expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
    });

    it("treats missing trailing components as 0", () => {
        expect(compareVersions("1.0", "1.0.0")).toBe(0);
        expect(compareVersions("1.0.0", "1.0")).toBe(0);
        expect(compareVersions("1", "1.0.0")).toBe(0);
    });

    it("supports four-component versions (major.minor.patch.build)", () => {
        expect(compareVersions("1.0.0.42", "1.0.0.41")).toBe(1);
        expect(compareVersions("1.0.0.0", "1.0.0")).toBe(0);
    });

    it("treats non-numeric components as 0", () => {
        expect(compareVersions("a.b.c", "1.0.0")).toBe(-1);
        expect(compareVersions("1.0.0", "a.b.c")).toBe(1);
        expect(compareVersions("a.b.c", "0.0.0")).toBe(0);
    });

    it("handles empty strings", () => {
        expect(compareVersions("", "")).toBe(0);
        expect(compareVersions("", "1.0.0")).toBe(-1);
        expect(compareVersions("1.0.0", "")).toBe(1);
    });
});

describe("isBelow", () => {
    it("returns true when current is strictly below threshold", () => {
        expect(isBelow("1.0.0", "1.0.1")).toBe(true);
        expect(isBelow("1.9.0", "1.10.0")).toBe(true);
    });

    it("returns false when current equals threshold", () => {
        expect(isBelow("1.0.0", "1.0.0")).toBe(false);
    });

    it("returns false when current is above threshold", () => {
        expect(isBelow("1.0.1", "1.0.0")).toBe(false);
    });
});

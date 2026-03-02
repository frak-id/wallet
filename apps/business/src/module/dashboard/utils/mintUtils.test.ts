import { describe, expect, it } from "vitest";
import { getDefaultStablecoin } from "./mintUtils";

describe("mintUtils", () => {
    describe("getDefaultStablecoin", () => {
        it("should return eure for European languages", () => {
            Object.defineProperty(navigator, "language", {
                value: "fr-FR",
                writable: true,
                configurable: true,
            });

            const result = getDefaultStablecoin();
            expect(result).toBe("eure");
        });

        it("should return usde for US English", () => {
            Object.defineProperty(navigator, "language", {
                value: "en-US",
                writable: true,
                configurable: true,
            });

            const result = getDefaultStablecoin();
            expect(result).toBe("usde");
        });

        it("should return gbpe for British English", () => {
            Object.defineProperty(navigator, "language", {
                value: "en-GB",
                writable: true,
                configurable: true,
            });

            const result = getDefaultStablecoin();
            expect(result).toBe("gbpe");
        });

        it("should return eure for other languages", () => {
            Object.defineProperty(navigator, "language", {
                value: "de-DE",
                writable: true,
                configurable: true,
            });

            const result = getDefaultStablecoin();
            expect(result).toBe("eure");
        });

        it("should handle case-insensitive language codes", () => {
            Object.defineProperty(navigator, "language", {
                value: "EN-US",
                writable: true,
                configurable: true,
            });

            const result = getDefaultStablecoin();
            expect(result).toBe("usde");
        });

        it("should return eure when navigator is undefined", () => {
            const originalNavigator = global.navigator;

            // @ts-expect-error - testing undefined navigator
            delete global.navigator;

            const result = getDefaultStablecoin();
            expect(result).toBe("eure");

            global.navigator = originalNavigator;
        });
    });
});

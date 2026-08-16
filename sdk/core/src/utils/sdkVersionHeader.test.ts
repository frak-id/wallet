import { afterEach, describe, expect, it, vi } from "vitest";
import { sdkVersionHeaders } from "./sdkVersionHeader";

describe("sdkVersionHeaders", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("emits the header when the version was substituted at build time", () => {
        vi.stubEnv("SDK_VERSION", "1.3.0");

        expect(sdkVersionHeaders()).toEqual({ "x-frak-sdk-version": "1.3.0" });
    });

    it("emits nothing when the version is an empty string", () => {
        vi.stubEnv("SDK_VERSION", "");

        expect(sdkVersionHeaders()).toEqual({});
    });

    it("emits nothing when the version is undefined", () => {
        vi.stubEnv("SDK_VERSION", undefined);

        expect(sdkVersionHeaders()).toEqual({});
    });

    it("emits nothing when the define was never substituted", () => {
        vi.stubEnv("SDK_VERSION", "process.env.SDK_VERSION");

        expect(sdkVersionHeaders()).toEqual({});
    });

    it("spreads to no key at all, never an undefined value", () => {
        vi.stubEnv("SDK_VERSION", undefined);

        const headers = { Accept: "application/json", ...sdkVersionHeaders() };

        expect("x-frak-sdk-version" in headers).toBe(false);
    });
});

import { describe, expect, it } from "vitest";
import { drift } from "./check-shopify-api-version";

describe("drift", () => {
    it("accepts every pin on the api_version release line", () => {
        expect(
            drift("2026-04", { app: "~2026.4.4", extension: "2026.4.0" })
        ).toEqual([]);
    });

    it("flags a pin on another release line", () => {
        expect(
            drift("2026-04", { app: "~2026.4.4", extension: "2025.10.1" })
        ).toEqual(["extension: 2025.10.1"]);
    });

    it("does not read 2026-01 as matching a 2026.10 pin", () => {
        expect(drift("2026-01", { app: "~2026.10.0" })).toEqual([
            "app: ~2026.10.0",
        ]);
    });

    it("flags a missing pin", () => {
        expect(drift("2026-04", { app: undefined })).toEqual(["app: missing"]);
    });
});

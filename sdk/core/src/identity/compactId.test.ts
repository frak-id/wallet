import { describe, expect, it } from "vitest";
import { compactUuid, expandCompactUuid } from "./compactId";

const UUID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

describe("compactUuid", () => {
    it("matches a fixed vector", () => {
        expect(compactUuid(UUID)).toBe("nIs-Kh1PSmuOLX86G1ydDg");
        expect(expandCompactUuid("nIs-Kh1PSmuOLX86G1ydDg")).toBe(UUID);
    });

    it("encodes a UUID as 22 base64url characters", () => {
        const compact = compactUuid(UUID);

        expect(compact).toHaveLength(22);
        expect(compact).toMatch(/^[A-Za-z0-9_-]{22}$/);
    });

    it("ignores the UUID's case", () => {
        expect(compactUuid(UUID.toUpperCase())).toBe(compactUuid(UUID));
    });

    it("returns undefined for a value that is not a UUID", () => {
        expect(compactUuid("not-a-uuid")).toBeUndefined();
        expect(compactUuid(UUID.replaceAll("-", ""))).toBeUndefined();
    });
});

describe("expandCompactUuid", () => {
    it("round-trips to the lowercase hyphenated UUID", () => {
        const compact = compactUuid(UUID.toUpperCase()) as string;

        expect(expandCompactUuid(compact)).toBe(UUID);
    });

    it("round-trips the all-zero and all-one UUIDs", () => {
        for (const uuid of [
            "00000000-0000-0000-0000-000000000000",
            "ffffffff-ffff-ffff-ffff-ffffffffffff",
        ]) {
            expect(expandCompactUuid(compactUuid(uuid) as string)).toBe(uuid);
        }
    });

    it("leaves a hyphenated UUID alone", () => {
        expect(expandCompactUuid(UUID)).toBeUndefined();
    });

    it("rejects the wrong length or alphabet", () => {
        const compact = compactUuid(UUID) as string;

        expect(expandCompactUuid(compact.slice(1))).toBeUndefined();
        expect(expandCompactUuid(`${compact}A`)).toBeUndefined();
        expect(expandCompactUuid(`${compact.slice(1)}+`)).toBeUndefined();
    });

    it("rejects a non-canonical spelling of the trailing bits", () => {
        const compact = compactUuid(
            "00000000-0000-0000-0000-000000000000"
        ) as string;

        expect(compact.endsWith("A")).toBe(true);
        expect(expandCompactUuid(`${compact.slice(0, -1)}B`)).toBeUndefined();
    });
});

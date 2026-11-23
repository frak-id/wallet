import { describe, expect, it } from "vitest";
import { signTimestampedBody, verifyTimestampedBody } from "./timestampedHmac";

const SECRET = "whsec_test";
const BODY = '{"id":"evt_1"}';
const NOW = 1_800_000_000;

function verify(
    overrides: Partial<Parameters<typeof verifyTimestampedBody>[0]>
) {
    const timestamp = String(NOW);
    return verifyTimestampedBody({
        secret: SECRET,
        timestamp,
        body: BODY,
        signatures: [
            signTimestampedBody({ secret: SECRET, timestamp, body: BODY }),
        ],
        nowSeconds: NOW,
        ...overrides,
    });
}

describe("verifyTimestampedBody", () => {
    it("accepts a fresh signature of the exact body", () => {
        expect(verify({})).toBe(true);
    });

    it("accepts when any one of several signatures matches", () => {
        const valid = signTimestampedBody({
            secret: SECRET,
            timestamp: String(NOW),
            body: BODY,
        });
        expect(verify({ signatures: ["deadbeef", valid] })).toBe(true);
    });

    it.each([
        ["another body", { body: '{"id":"evt_2"}' }],
        ["another secret", { secret: "whsec_other" }],
        ["an empty secret", { secret: "" }],
        ["a timestamp past the tolerance", { nowSeconds: NOW + 301 }],
        ["a non-numeric timestamp", { timestamp: "now" }],
        ["no signature", { signatures: [] }],
    ])("rejects %s", (_name, overrides) => {
        expect(verify(overrides)).toBe(false);
    });
});

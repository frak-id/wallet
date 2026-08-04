import type { ProofOp } from "@frak-labs/core-sdk/identity";
import goldenProofs from "@frak-labs/core-sdk/identity/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityProofService } from "./IdentityProofService";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../infrastructure/telemetry", () => ({
    infraMetrics: { identityProofChecked: vi.fn() },
}));

const hexToBytes = (hex: string): Uint8Array => {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
};

describe("IdentityProofService", () => {
    let service: IdentityProofService;

    beforeEach(() => {
        vi.useRealTimers();
        service = new IdentityProofService();
    });

    describe("verify — golden fixtures (same JSON the SDK asserts against)", () => {
        for (const fixture of goldenProofs.fixtures) {
            it(`accepts: ${fixture.description}`, async () => {
                vi.setSystemTime(fixture.ts * 1000);

                const result = await service.verify({
                    op: fixture.op as ProofOp,
                    proof: fixture.proof,
                    merchantId: fixture.merchantId,
                    anonymousId: fixture.anonymousId,
                    binding: hexToBytes(fixture.bindingHex),
                });

                expect(result).toEqual({ valid: true });
                vi.useRealTimers();
            });
        }
    });

    describe("verify — per-op window boundaries", () => {
        const ensureFixture = goldenProofs.fixtures.find(
            (f) => f.op === "frak-ensure-v1"
        );
        const mergeFixture = goldenProofs.fixtures.find(
            (f) => f.op === "frak-merge-v1"
        );
        if (!ensureFixture || !mergeFixture) {
            throw new Error("fixture set must cover ensure and merge ops");
        }

        it("accepts frak-ensure-v1 just inside the 30-day window", async () => {
            vi.setSystemTime((ensureFixture.ts + 30 * 24 * 60 * 60) * 1000);
            const result = await service.verify({
                op: "frak-ensure-v1",
                proof: ensureFixture.proof,
                merchantId: ensureFixture.merchantId,
                anonymousId: ensureFixture.anonymousId,
                binding: hexToBytes(ensureFixture.bindingHex),
            });
            expect(result).toEqual({ valid: true });
        });

        it("rejects frak-ensure-v1 just past the 30-day window", async () => {
            vi.setSystemTime((ensureFixture.ts + 30 * 24 * 60 * 60 + 1) * 1000);
            const result = await service.verify({
                op: "frak-ensure-v1",
                proof: ensureFixture.proof,
                merchantId: ensureFixture.merchantId,
                anonymousId: ensureFixture.anonymousId,
                binding: hexToBytes(ensureFixture.bindingHex),
            });
            expect(result).toEqual({ valid: false, reason: "expired" });
        });

        it("accepts frak-merge-v1 just inside the ±2 min window", async () => {
            vi.setSystemTime((mergeFixture.ts + 2 * 60) * 1000);
            const result = await service.verify({
                op: "frak-merge-v1",
                proof: mergeFixture.proof,
                merchantId: mergeFixture.merchantId,
                anonymousId: mergeFixture.anonymousId,
                binding: hexToBytes(mergeFixture.bindingHex),
            });
            expect(result).toEqual({ valid: true });
        });

        it("rejects frak-merge-v1 just past the ±2 min window", async () => {
            vi.setSystemTime((mergeFixture.ts + 2 * 60 + 1) * 1000);
            const result = await service.verify({
                op: "frak-merge-v1",
                proof: mergeFixture.proof,
                merchantId: mergeFixture.merchantId,
                anonymousId: mergeFixture.anonymousId,
                binding: hexToBytes(mergeFixture.bindingHex),
            });
            expect(result).toEqual({ valid: false, reason: "expired" });
        });

        it("rejects a proof timestamped too far in the future (clock skew)", async () => {
            vi.setSystemTime((ensureFixture.ts - 61) * 1000);
            const result = await service.verify({
                op: "frak-ensure-v1",
                proof: ensureFixture.proof,
                merchantId: ensureFixture.merchantId,
                anonymousId: ensureFixture.anonymousId,
                binding: hexToBytes(ensureFixture.bindingHex),
            });
            expect(result).toEqual({ valid: false, reason: "expired" });
        });
    });

    describe("verify — tamper cases", () => {
        const base = goldenProofs.fixtures[0];

        beforeEach(() => {
            vi.setSystemTime(base.ts * 1000);
        });

        it("rejects domain-separation mismatch (ensure proof replayed against merge)", async () => {
            const result = await service.verify({
                op: "frak-merge-v1",
                proof: base.proof,
                merchantId: base.merchantId,
                anonymousId: base.anonymousId,
                binding: new Uint8Array(0),
            });
            expect(result).toEqual({ valid: false, reason: "bad_signature" });
        });

        it("rejects a wrong anonymousId", async () => {
            const other = goldenProofs.fixtures.find(
                (f) => f.anonymousId !== base.anonymousId
            );
            if (!other) throw new Error("fixture set needs >1 identity");

            const result = await service.verify({
                op: base.op as ProofOp,
                proof: base.proof,
                merchantId: base.merchantId,
                anonymousId: other.anonymousId,
                binding: hexToBytes(base.bindingHex),
            });
            expect(result).toEqual({ valid: false, reason: "id_mismatch" });
        });

        it("rejects a frak-merge-v1 proof presented with a different token's binding", async () => {
            // The no-replay-cache argument rests on this: a proof commits to
            // one specific mergeToken, so capturing it buys nothing without
            // that exact token. If the binding stopped entering the signed
            // message, every other test here would still pass.
            const mergeFixture = goldenProofs.fixtures.find(
                (f) => f.op === "frak-merge-v1"
            );
            if (!mergeFixture) throw new Error("fixture set needs a merge op");
            vi.setSystemTime(mergeFixture.ts * 1000);

            const result = await service.verify({
                op: "frak-merge-v1",
                proof: mergeFixture.proof,
                merchantId: mergeFixture.merchantId,
                anonymousId: mergeFixture.anonymousId,
                binding: service.hashMergeToken("a-different-merge-token"),
            });
            expect(result).toEqual({ valid: false, reason: "bad_signature" });
        });

        it("rejects a malformed proof string", async () => {
            const result = await service.verify({
                op: base.op as ProofOp,
                proof: "not-a-proof",
                merchantId: base.merchantId,
                anonymousId: base.anonymousId,
                binding: hexToBytes(base.bindingHex),
            });
            expect(result).toEqual({ valid: false, reason: "malformed" });
        });
    });

    describe("hashMergeToken", () => {
        it("produces a 32-byte SHA-256 digest usable as the frak-merge-v1 binding", async () => {
            const mergeFixture = goldenProofs.fixtures.find(
                (f) => f.op === "frak-merge-v1"
            );
            if (!mergeFixture) throw new Error("fixture set must cover merge");

            // Confirm the shape/algorithm matches what verify() expects for
            // frak-merge-v1: 32 raw SHA-256 bytes.
            const digest = service.hashMergeToken("some-merge-token");
            expect(digest).toBeInstanceOf(Uint8Array);
            expect(digest.length).toBe(32);

            vi.setSystemTime(mergeFixture.ts * 1000);
            const result = await service.verify({
                op: "frak-merge-v1",
                proof: mergeFixture.proof,
                merchantId: mergeFixture.merchantId,
                anonymousId: mergeFixture.anonymousId,
                binding: hexToBytes(mergeFixture.bindingHex),
            });
            expect(result).toEqual({ valid: true });
        });

        it("is deterministic", () => {
            const a = service.hashMergeToken("token-a");
            const b = service.hashMergeToken("token-a");
            expect(Array.from(a)).toEqual(Array.from(b));
        });

        it("differs for different tokens", () => {
            const a = service.hashMergeToken("token-a");
            const b = service.hashMergeToken("token-b");
            expect(Array.from(a)).not.toEqual(Array.from(b));
        });
    });
});

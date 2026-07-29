import { p256 } from "@noble/curves/nist.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProofMessage, decodeProof } from "./canonical";
import { ensureIdentityKey, signProof } from "./sign";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

describe("sign", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe("ensureIdentityKey", () => {
        it("generates a derived id and persists key + id together", async () => {
            const result = await ensureIdentityKey();

            expect(result.derived).toBe(true);
            expect(result.clientId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
            expect(localStorage.getItem("frak-client-id")).toBe(
                result.clientId
            );
            expect(localStorage.getItem("frak-client-key")).toBeTruthy();
        });

        it("is deterministic across calls: same key produces the same derived id", async () => {
            const first = await ensureIdentityKey();
            const second = await ensureIdentityKey();

            expect(second.clientId).toBe(first.clientId);
            expect(second.derived).toBe(true);
        });

        it("re-derives from the key rather than trusting a mismatched stored id (§2.3 atomicity)", async () => {
            const first = await ensureIdentityKey();

            localStorage.setItem(
                "frak-client-id",
                "00000000-0000-0000-0000-000000000000"
            );

            const second = await ensureIdentityKey();

            expect(second.clientId).toBe(first.clientId);
            expect(localStorage.getItem("frak-client-id")).toBe(first.clientId);
        });

        it("keeps a legacy id untouched when no key exists yet (§2.6 D6: no migration merge)", async () => {
            localStorage.setItem("frak-client-id", "legacy-random-id");

            const result = await ensureIdentityKey();

            expect(result.derived).toBe(false);
            expect(result.clientId).toBe("legacy-random-id");
            expect(localStorage.getItem("frak-client-key")).toBeNull();
        });

        it("regenerates both key and id when the stored key is corrupt", async () => {
            localStorage.setItem("frak-client-id", "some-id");
            localStorage.setItem("frak-client-key", "not valid json");

            const result = await ensureIdentityKey();

            expect(result.derived).toBe(false);
            expect(localStorage.getItem("frak-client-key")).toBeNull();
            expect(result.clientId).toBeTruthy();
        });

        it("still derives when crypto.subtle is unavailable (§2.4 pure-JS fallback)", async () => {
            const { subtle } = crypto;
            Object.defineProperty(crypto, "subtle", {
                value: undefined,
                configurable: true,
            });
            // The signer is cached per module load, and the tests above
            // already cached the WebCrypto one.
            vi.resetModules();

            try {
                const { ensureIdentityKey: freshEnsure } = await import(
                    "./sign"
                );
                const result = await freshEnsure();

                expect(result.derived).toBe(true);
                expect(localStorage.getItem("frak-client-key")).toBeTruthy();
                expect(localStorage.getItem("frak-client-id")).toBe(
                    result.clientId
                );
            } finally {
                Object.defineProperty(crypto, "subtle", {
                    value: subtle,
                    configurable: true,
                });
            }
        });
    });

    describe("signProof", () => {
        it("returns null when no key exists (legacy id, nothing to sign with)", async () => {
            localStorage.setItem("frak-client-id", "legacy-id");

            const proof = await signProof({
                op: "frak-ensure-v1",
                merchantId: MERCHANT_ID,
                anonymousId: "legacy-id",
            });

            expect(proof).toBeNull();
        });

        it("produces a decodable, verifiable-shaped proof for frak-ensure-v1", async () => {
            const { clientId } = await ensureIdentityKey();

            const proof = await signProof({
                op: "frak-ensure-v1",
                merchantId: MERCHANT_ID,
                anonymousId: clientId,
            });

            expect(proof).toBeTruthy();
            const decoded = proof ? decodeProof(proof) : null;
            expect(decoded).not.toBeNull();
            expect(decoded?.pk.length).toBe(65);
            expect(decoded?.pk[0]).toBe(0x04);
            expect(decoded?.sig.length).toBe(64);
            expect(decoded?.v).toBe(1);
        });

        it("produces a proof for frak-merge-v1 with a binding", async () => {
            const { clientId } = await ensureIdentityKey();
            const binding = new Uint8Array(32).fill(7);

            const proof = await signProof({
                op: "frak-merge-v1",
                merchantId: MERCHANT_ID,
                anonymousId: clientId,
                binding,
            });

            expect(proof).toBeTruthy();
        });

        it("produces a signature that independently verifies against the canonical message", async () => {
            const { clientId } = await ensureIdentityKey();
            const ts = 1_700_000_000;

            const proof = await signProof({
                op: "frak-ensure-v1",
                merchantId: MERCHANT_ID,
                anonymousId: clientId,
                ts,
            });
            const decoded = proof ? decodeProof(proof) : null;
            expect(decoded).not.toBeNull();
            if (!decoded) return;

            const message = buildProofMessage({
                op: "frak-ensure-v1",
                merchantId: MERCHANT_ID,
                anonymousId: clientId,
                binding: new Uint8Array(0),
                ts,
            });

            expect(
                p256.verify(decoded.sig, message, decoded.pk, {
                    prehash: true,
                })
            ).toBe(true);

            // Low-S normalisation (docs/plans/identity-proof-of-possession/README.md §2.3).
            const s = BigInt(
                `0x${Array.from(decoded.sig.slice(32), (b) =>
                    b.toString(16).padStart(2, "0")
                ).join("")}`
            );
            expect(s <= p256.Point.Fn.ORDER / 2n).toBe(true);
        });

        it("never throws when the merchantId is malformed", async () => {
            const { clientId } = await ensureIdentityKey();

            await expect(
                signProof({
                    op: "frak-ensure-v1",
                    merchantId: "not-a-uuid",
                    anonymousId: clientId,
                })
            ).resolves.toBeNull();
        });
    });
});

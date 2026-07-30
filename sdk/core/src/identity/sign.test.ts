import { p256 } from "@noble/curves/nist.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProofMessage, decodeProof } from "./canonical";
import {
    clearPendingLegacyId,
    ensureIdentityKey,
    getPendingLegacyId,
    signProof,
} from "./sign";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

describe("sign", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        // `stubGlobal` survives `restoreAllMocks`; the no-entropy test stubs
        // `crypto` away and would otherwise break every subsequent test.
        vi.unstubAllGlobals();
    });

    describe("ensureIdentityKey", () => {
        it("generates a derived id and persists key + id together", async () => {
            const result = await ensureIdentityKey();

            expect(result.clientId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
            expect(localStorage.getItem("frak-client-id")).toBe(
                result.clientId
            );
            // Raw 32-byte private key, stored as 64 lowercase hex chars.
            expect(localStorage.getItem("frak-client-key")).toMatch(
                /^[0-9a-f]{64}$/
            );
        });

        it("is deterministic across calls: same key produces the same derived id", async () => {
            const first = await ensureIdentityKey();
            const second = await ensureIdentityKey();

            expect(second.clientId).toBe(first.clientId);
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

        it("derives over a legacy id and flags it for migration (§2.6)", async () => {
            localStorage.setItem("frak-client-id", "legacy-random-id");

            const result = await ensureIdentityKey();

            // The id flips immediately, before the caller boots the iframe,
            // so the listener is only ever seeded with the derived id.

            expect(result.clientId).not.toBe("legacy-random-id");
            expect(localStorage.getItem("frak-client-id")).toBe(
                result.clientId
            );
            expect(localStorage.getItem("frak-client-key")).not.toBeNull();

            // The legacy id is durably marked so the merge retries until it
            // confirms, rather than being orphaned by a failed first attempt.
            expect(result.pendingLegacyId).toBe("legacy-random-id");
            expect(localStorage.getItem("frak-client-id-legacy")).toBe(
                "legacy-random-id"
            );
        });

        it("re-reports an unconfirmed legacy id on later visits (§2.6 retry)", async () => {
            localStorage.setItem("frak-client-id", "legacy-random-id");
            const first = await ensureIdentityKey();

            // Second visit: key is now on file, but the previous merge never
            // confirmed, so the marker survives and must be surfaced again.
            const second = await ensureIdentityKey();

            expect(second.clientId).toBe(first.clientId);

            expect(second.pendingLegacyId).toBe("legacy-random-id");
        });

        it("stops re-reporting once the migration is cleared", async () => {
            localStorage.setItem("frak-client-id", "legacy-random-id");
            await ensureIdentityKey();

            clearPendingLegacyId();

            const after = await ensureIdentityKey();
            expect(after.pendingLegacyId).toBeUndefined();
            expect(getPendingLegacyId()).toBeUndefined();
        });

        it("clears a corrupt key and rethrows rather than minting an unprovable id", async () => {
            localStorage.setItem("frak-client-id", "some-id");
            // Not 64 hex chars — corrupt under the raw-hex storage format.
            localStorage.setItem("frak-client-key", "not valid hex");

            await expect(ensureIdentityKey()).rejects.toThrow();

            // The unusable key is cleared so the NEXT visit derives cleanly
            // instead of failing forever on the same corrupt material.
            expect(localStorage.getItem("frak-client-key")).toBeNull();

            const retry = await ensureIdentityKey();
            expect(retry.clientId).toBeTruthy();
            expect(retry.pendingLegacyId).toBe("some-id");
        });

        it("rejects when no entropy source exists, never returning an unprovable id", async () => {
            vi.stubGlobal("crypto", {});

            await expect(ensureIdentityKey()).rejects.toThrow(
                /getRandomValues/
            );
        });

        it("still derives when crypto.subtle is unavailable (§2.4 pure-JS fallback)", async () => {
            const { subtle } = crypto;
            Object.defineProperty(crypto, "subtle", {
                value: undefined,
                configurable: true,
            });
            // The signer choice lives in a module-level promise, and the
            // tests above already resolved it to WebCrypto. Force
            // re-detection by resetting modules and re-importing.
            vi.resetModules();

            try {
                const { ensureIdentityKey: freshEnsure } = await import(
                    "./sign"
                );
                const result = await freshEnsure();

                expect(localStorage.getItem("frak-client-key")).toMatch(
                    /^[0-9a-f]{64}$/
                );
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

        it("embeds the public key matching the stored key, across key rotation", async () => {
            // The pubkey is cached against the key it was derived from — a
            // rotated key must miss the cache, not sign with the old pubkey.
            const { clientId: firstId } = await ensureIdentityKey();

            const first = await signProof({
                op: "frak-ensure-v1",
                merchantId: MERCHANT_ID,
                anonymousId: firstId,
            });

            localStorage.clear();
            const { clientId: secondId } = await ensureIdentityKey();
            const rotatedKey = localStorage.getItem("frak-client-key") ?? "";

            const second = await signProof({
                op: "frak-ensure-v1",
                merchantId: MERCHANT_ID,
                anonymousId: secondId,
            });

            const firstPk = first ? decodeProof(first)?.pk : null;
            const secondPk = second ? decodeProof(second)?.pk : null;
            expect(firstPk).not.toEqual(secondPk);
            expect(secondPk).toEqual(
                p256.getPublicKey(
                    Uint8Array.from(rotatedKey.match(/../g) ?? [], (b) =>
                        Number.parseInt(b, 16)
                    ),
                    false
                )
            );
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

            // No low-S normalisation: plain ECDSA verifiers accept both
            // low- and high-S, so verification must pass with strict low-S
            // disabled — asserting `s <= n/2` here would be wrong.
            expect(
                p256.verify(decoded.sig, message, decoded.pk, {
                    prehash: true,
                    lowS: false,
                })
            ).toBe(true);
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

        it("signs via the pure-JS fallback when WebCrypto is unavailable", async () => {
            // `isSupported()` caches its result inside `@noble/curves`'s own
            // module scope, which `vi.resetModules()` won't reliably
            // re-evaluate for an already-loaded external package. Mock it to
            // force the fallback deterministically instead of tearing down
            // `crypto.subtle`.
            vi.doMock("@noble/curves/webcrypto.js", async () => {
                const actual = await vi.importActual<
                    typeof import("@noble/curves/webcrypto.js")
                >("@noble/curves/webcrypto.js");
                return {
                    p256: { ...actual.p256, isSupported: async () => false },
                };
            });
            vi.resetModules();

            try {
                const {
                    ensureIdentityKey: freshEnsure,
                    signProof: freshSignProof,
                } = await import("./sign");

                const { clientId } = await freshEnsure();
                const ts = 1_700_000_000;
                const proof = await freshSignProof({
                    op: "frak-ensure-v1",
                    merchantId: MERCHANT_ID,
                    anonymousId: clientId,
                    ts,
                });

                expect(proof).toBeTruthy();
                const decoded = proof ? decodeProof(proof) : null;
                expect(decoded).not.toBeNull();
                if (!decoded) return;
                expect(decoded.pk.length).toBe(65);
                expect(decoded.sig.length).toBe(64);

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
                        lowS: false,
                    })
                ).toBe(true);
            } finally {
                vi.doUnmock("@noble/curves/webcrypto.js");
            }
        });

        it("does not poison later calls when the stored key is corrupt: a later valid call still succeeds", async () => {
            const { clientId } = await ensureIdentityKey();

            // Corrupt the stored key so the next signProof's read fails.
            const validKeyHex = localStorage.getItem("frak-client-key");
            localStorage.setItem("frak-client-key", "not valid hex");

            const failed = await signProof({
                op: "frak-ensure-v1",
                merchantId: MERCHANT_ID,
                anonymousId: clientId,
            });
            expect(failed).toBeNull();

            // Restore valid key material — must still work, not stay poisoned.
            if (validKeyHex) {
                localStorage.setItem("frak-client-key", validKeyHex);
            }
            const recovered = await signProof({
                op: "frak-ensure-v1",
                merchantId: MERCHANT_ID,
                anonymousId: clientId,
            });
            expect(recovered).toBeTruthy();
        });
    });
});

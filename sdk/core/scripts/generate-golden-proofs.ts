/**
 * Generates `src/identity/fixtures/golden-proofs.json` — the frozen
 * cross-platform proof-of-possession fixtures (Phase 0, README §8).
 *
 * Re-runnable, but deliberately produces IDENTICAL output every time: the
 * private keys below are hardcoded test-only constants, not fresh
 * randomness. A fixture file regenerated with fresh randomness on each run
 * is a round-trip test, not a golden fixture — round-trip tests pass even
 * when two implementations are identically wrong (README §8).
 *
 * Run: `bun run scripts/generate-golden-proofs.ts` from `sdk/core/`.
 *
 * Consumers of the resulting JSON (must never diverge, by construction):
 *  - `src/identity/canonical.test.ts` (this package)
 *  - `src/identity/verify.test.ts` (this package, added in a later commit)
 *  - `services/backend/src/domain/identity/services/IdentityProofService.test.ts`
 *    (imports the SAME file via `@frak-labs/core-sdk/identity/fixtures`)
 *  - native SDKs (Phase 6) read this same repo path; never copy it
 */

import { p256 } from "@noble/curves/nist.js";
import {
    buildProofMessage,
    deriveClientIdFromHash,
    encodeProof,
} from "../src/identity/canonical";
import type { ProofOp } from "../src/identity/types";

const bytesToHex = (bytes: Uint8Array): string =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const hexToBytes = (hex: string): Uint8Array => {
    const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
};

async function sha256Hex(bytes: Uint8Array): Promise<Uint8Array> {
    const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return new Uint8Array(digest);
}

// Hardcoded, test-only P-256 private keys (32 bytes / 64 hex chars each).
// Never use these for anything but golden fixture generation — they are
// public, by design.
const TEST_PRIVATE_KEYS = [
    "0101010101010101010101010101010101010101010101010101010101010101",
    "c8b3e2a11d4f4a6b8e2d7f3a1b5c9d0ee2a11d4f4a6b8e2d7f3a1b5c9d0e1234",
] as const;

type FixtureEntry = {
    description: string;
    privkeyHex: string;
    pubkeyUncompressedHex: string;
    derivedClientId: string;
    op: ProofOp;
    merchantId: string;
    anonymousId: string;
    bindingHex: string;
    ts: number;
    canonicalMsgHex: string;
    sigHex: string;
    proof: string;
};

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const FIXED_TS = 1_700_000_000; // 2023-11-14T22:13:20Z — fixed, not "now".

async function buildFixture(params: {
    description: string;
    privkeyHex: string;
    op: ProofOp;
    merchantId: string;
    anonymousIdOverride?: string;
    bindingHex?: string;
    ts?: number;
}): Promise<FixtureEntry> {
    const privkey = hexToBytes(params.privkeyHex);
    const pubkey = p256.getPublicKey(privkey, false);
    const hash = await sha256Hex(pubkey);
    const derivedClientId = deriveClientIdFromHash(hash);
    const anonymousId = params.anonymousIdOverride ?? derivedClientId;
    const binding = params.bindingHex
        ? hexToBytes(params.bindingHex)
        : new Uint8Array(0);
    const ts = params.ts ?? FIXED_TS;

    const msg = buildProofMessage({
        op: params.op,
        merchantId: params.merchantId,
        anonymousId,
        binding,
        ts,
    });

    const sig = p256.sign(msg, privkey);

    const proof = encodeProof({ v: 1, pk: pubkey, ts, sig });

    return {
        description: params.description,
        privkeyHex: params.privkeyHex,
        pubkeyUncompressedHex: bytesToHex(pubkey),
        derivedClientId,
        op: params.op,
        merchantId: params.merchantId,
        anonymousId,
        bindingHex: bytesToHex(binding),
        ts,
        canonicalMsgHex: bytesToHex(msg),
        sigHex: bytesToHex(sig),
        proof,
    };
}

async function main() {
    const [key1, key2] = TEST_PRIVATE_KEYS;

    const mergeBindingHex = bytesToHex(
        await sha256Hex(new TextEncoder().encode("test-merge-token-fixture"))
    );

    const fixtures: FixtureEntry[] = await Promise.all([
        buildFixture({
            description: "keypair 1, frak-ensure-v1, empty binding",
            privkeyHex: key1,
            op: "frak-ensure-v1",
            merchantId: MERCHANT_ID,
        }),
        buildFixture({
            description:
                "keypair 1, frak-merge-v1, real 32-byte SHA-256(mergeToken) binding",
            privkeyHex: key1,
            op: "frak-merge-v1",
            merchantId: MERCHANT_ID,
            bindingHex: mergeBindingHex,
        }),
        buildFixture({
            description: "keypair 1, frak-install-v1, empty binding",
            privkeyHex: key1,
            op: "frak-install-v1",
            merchantId: MERCHANT_ID,
        }),
        buildFixture({
            description:
                "keypair 2, frak-ensure-v1, uppercase merchantId normalised to lowercase before signing",
            privkeyHex: key2,
            op: "frak-ensure-v1",
            merchantId: MERCHANT_ID.toUpperCase(),
        }),
        buildFixture({
            description:
                "keypair 2, frak-merge-v1, fixed ts at a different known value",
            privkeyHex: key2,
            op: "frak-merge-v1",
            merchantId: MERCHANT_ID,
            bindingHex: mergeBindingHex,
            ts: 1_800_000_000,
        }),
    ]);

    const output = {
        // Bump if the byte layout in canonical.ts ever changes. Consumers
        // should assert this matches their own expected format version.
        formatVersion: 1,
        fixtures,
    };

    const outPath = new URL(
        "../src/identity/fixtures/golden-proofs.json",
        import.meta.url
    );
    await Bun.write(outPath, `${JSON.stringify(output, null, 4)}\n`);
    console.log(`Wrote ${fixtures.length} fixtures to ${outPath.pathname}`);
}

main();

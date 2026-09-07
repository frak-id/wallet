/**
 * Generates `src/context/fixtures/golden-context.json` — the frozen
 * cross-platform FrakContext V2 binary-codec fixtures.
 *
 * Re-runnable, but deliberately produces IDENTICAL output every time: every
 * UUID, timestamp and wallet address below is a hardcoded test-only constant,
 * never `crypto.randomUUID()` and never `Date.now()`. A fixture regenerated
 * with fresh randomness (or stamped with a generation time) each run is a
 * round-trip test, not a golden fixture — round-trip tests pass even when two
 * implementations are identically wrong, and a non-deterministic corpus can
 * never be diffed to prove that a regeneration changed no semantics.
 *
 * For the same reason the envelope carries NO `generatedAt` and no absolute
 * paths: regeneration with no semantic change must produce a zero-diff.
 *
 * The expected values are computed by RUNNING the codec, but every one of them
 * is also independently derivable by hand from the wire layout documented in
 * `src/context/frakContextV2Codec.ts` — that is what makes them checkable by a
 * Kotlin/Swift implementation with no TS runtime.
 *
 * Run: `bun run fixtures:generate:context` from `sdk/core/`.
 *
 * Consumers (must never diverge, by construction):
 *  - `src/context/frakContextV2Codec.test.ts` (this package)
 *  - native SDKs read this same repo path via `@frak-labs/core-sdk/context/fixtures`;
 *    never copy it
 */

import type { Address } from "viem";
import { FrakContextManager } from "../src/context/frakContext";
import {
    decodeFrakContextV2,
    encodeFrakContextV2,
} from "../src/context/frakContextV2Codec";
import type { FrakContext, FrakContextV2 } from "../src/types";
import { base64urlEncode } from "../src/utils/compression/b64";

const bytesToHex = (bytes: Uint8Array): string =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const hexToBytes = (hex: string): Uint8Array => {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
};

// Hardcoded, test-only identifiers. Never use these for anything but golden
// fixture generation — they are public, by design.
const MERCHANT = "550e8400-e29b-41d4-a716-446655440000";
const CLIENT = "550e8400-e29b-41d4-a716-446655440001";
const MERCHANT_ALT = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const WALLET = "0x1234567890123456789012345678901234567890" as Address;
const WALLET_MIXED_CASE =
    "0xAbCdEf0123456789012345678901234567890123" as Address;
const UUID_ZERO = "00000000-0000-0000-0000-000000000000";
const UUID_MAX = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const WALLET_MAX = "0xffffffffffffffffffffffffffffffffffffffff" as Address;

/** 2024-03-05T16:00:00Z — a plausible "normal" link creation time, fixed. */
const TS_NORMAL = 1_709_654_400;
/** Unix epoch — the uint32 lower bound. */
const TS_MIN = 0;
/** 0xffffffff — the uint32 upper bound, INCLUSIVE (verified accepted). */
const TS_MAX = 4_294_967_295;

/**
 * A positive vector: `input` MUST encode to exactly these bytes, and those
 * bytes MUST decode back to exactly `expected.decoded`.
 */
type EncodeFixture = {
    name: string;
    description: string;
    kind: "encode";
    input: FrakContextV2;
    expected: {
        /** Encoded length in bytes: 37 (c), 41 (w), or 57 (c+w). */
        byteLength: number;
        /** Lower-case hex of the encoded bytes, no `0x` prefix. */
        hex: string;
        /** Unpadded base64url of the encoded bytes. */
        base64url: string;
        /** Length of `base64url` in characters (no `=` padding). */
        base64urlLength: number;
        /** Decode direction: what decoding those bytes must return. */
        decoded: FrakContextV2;
    };
};

/**
 * A negative vector: the named direction MUST refuse the input by returning
 * null/nil (never by throwing).
 *
 * - `direction: "encode"`     → encoding `input` returns null
 * - `direction: "decode"`     → decoding `inputHex` returns null
 * - `direction: "decompress"` → decompressing `inputBase64url` returns null/nil
 */
type RejectFixture = {
    name: string;
    description: string;
    kind: "reject";
    direction: "encode" | "decode" | "decompress";
    /** Why the value is refused — for failure messages, not for assertions. */
    reason: string;
    /** Present when direction is "encode". Intentionally ill-typed input. */
    input?: unknown;
    /** Present when direction is "decode". */
    inputHex?: string;
    /** Present when direction is "decompress". */
    inputBase64url?: string;
    /** Always null: every rejection path returns null/nil, never throws. */
    expected: null;
    /**
     * Only on `direction: "decode"` vectors. What the OUTER, length-based
     * decoder (`FrakContextManager.decompress`) makes of the same bytes.
     * `null` means it also refuses; a V1 object here proves the 20-byte
     * V1-vs-V2 length disambiguation is real and not an accident.
     */
    decompressesTo?: FrakContext | null;
};

type FixtureEntry = EncodeFixture | RejectFixture;

function buildEncodeFixture(params: {
    name: string;
    description: string;
    input: FrakContextV2;
}): EncodeFixture {
    const encoded = encodeFrakContextV2(params.input);
    if (!encoded) {
        throw new Error(
            `Fixture "${params.name}" was expected to encode, but the codec returned null`
        );
    }
    const decoded = decodeFrakContextV2(encoded);
    if (!decoded) {
        throw new Error(
            `Fixture "${params.name}" encoded but did not decode — the corpus would be self-inconsistent`
        );
    }
    const base64url = base64urlEncode(encoded);

    return {
        name: params.name,
        description: params.description,
        kind: "encode",
        input: params.input,
        expected: {
            byteLength: encoded.length,
            hex: bytesToHex(encoded),
            base64url,
            base64urlLength: base64url.length,
            decoded,
        },
    };
}

function buildEncodeRejectFixture(params: {
    name: string;
    description: string;
    reason: string;
    input: unknown;
}): RejectFixture {
    const result = encodeFrakContextV2(params.input as FrakContextV2);
    if (result !== null) {
        throw new Error(
            `Fixture "${params.name}" was expected to be rejected on encode, but the codec accepted it`
        );
    }
    return {
        name: params.name,
        description: params.description,
        kind: "reject",
        direction: "encode",
        reason: params.reason,
        input: params.input,
        expected: null,
    };
}

function buildDecodeRejectFixture(params: {
    name: string;
    description: string;
    reason: string;
    inputHex: string;
}): RejectFixture {
    const bytes = hexToBytes(params.inputHex);
    const result = decodeFrakContextV2(bytes);
    if (result !== null) {
        throw new Error(
            `Fixture "${params.name}" was expected to be rejected on decode, but the codec accepted it`
        );
    }
    // Record what the outer length-based decoder does with the same bytes.
    const outer = FrakContextManager.decompress(base64urlEncode(bytes)) ?? null;
    return {
        name: params.name,
        description: params.description,
        kind: "reject",
        direction: "decode",
        reason: params.reason,
        inputHex: params.inputHex,
        expected: null,
        decompressesTo: outer,
    };
}

function buildDecompressRejectFixture(params: {
    name: string;
    description: string;
    reason: string;
    inputBase64url: string;
}): RejectFixture {
    const result = FrakContextManager.decompress(params.inputBase64url);
    if (result !== undefined) {
        throw new Error(
            `Fixture "${params.name}" was expected to be rejected on decompress, but it produced a context`
        );
    }
    return {
        name: params.name,
        description: params.description,
        kind: "reject",
        direction: "decompress",
        reason: params.reason,
        inputBase64url: params.inputBase64url,
        expected: null,
    };
}

/** Encode a known-good context and flip bits in its header, deterministically. */
function tamperedHeaderHex(
    ctx: FrakContextV2,
    mutate: (header: number) => number
): string {
    const encoded = encodeFrakContextV2(ctx);
    if (!encoded) throw new Error("tamper base failed to encode");
    const copy = new Uint8Array(encoded);
    copy[0] = mutate(copy[0]) & 0xff;
    return bytesToHex(copy);
}

/** Encode a known-good context and return a prefix of it, as hex. */
function truncatedHex(ctx: FrakContextV2, length: number): string {
    const encoded = encodeFrakContextV2(ctx);
    if (!encoded) throw new Error("truncation base failed to encode");
    return bytesToHex(encoded.subarray(0, length));
}

async function main() {
    const cOnly: FrakContextV2 = {
        v: 2,
        m: MERCHANT,
        t: TS_NORMAL,
        c: CLIENT,
    };

    const fixtures: FixtureEntry[] = [
        // ── Group 1: presence combinations of c / w ──────────────────────
        buildEncodeFixture({
            name: "c-only",
            description:
                "clientId only, no wallet — 37 bytes, header 0x12 (v2 | has_c)",
            input: cOnly,
        }),
        buildEncodeFixture({
            name: "w-only",
            description:
                "wallet only, no clientId — 41 bytes, header 0x22 (v2 | has_w)",
            input: { v: 2, m: MERCHANT, t: TS_NORMAL, w: WALLET },
        }),
        buildEncodeFixture({
            name: "c-and-w",
            description:
                "clientId and wallet both present — 57 bytes, header 0x32 (v2 | has_c | has_w)",
            input: {
                v: 2,
                m: MERCHANT,
                t: TS_NORMAL,
                c: CLIENT,
                w: WALLET,
            },
        }),
        buildEncodeFixture({
            name: "empty-client-string-treated-as-absent",
            description:
                'c is the empty string, which the encoder treats as ABSENT rather than as an invalid UUID — it falls back to the wallet-only 41-byte layout and the decoded context has no "c" key at all',
            input: { v: 2, m: MERCHANT, t: TS_NORMAL, c: "", w: WALLET },
        }),

        // ── Group 2: timestamp edge values (big-endian uint32) ───────────
        buildEncodeFixture({
            name: "timestamp-zero",
            description:
                "timestamp 0 (Unix epoch, uint32 lower bound) — the four timestamp bytes are 00000000",
            input: { v: 2, m: MERCHANT, t: TS_MIN, c: CLIENT },
        }),
        buildEncodeFixture({
            name: "timestamp-uint32-max",
            description:
                "timestamp 4294967295 (0xffffffff, uint32 upper bound) — VERIFIED ACCEPTED: the guard is t > 0xffffffff, so the boundary itself is inclusive and the four timestamp bytes are ffffffff",
            input: { v: 2, m: MERCHANT, t: TS_MAX, c: CLIENT, w: WALLET },
        }),
        buildEncodeFixture({
            name: "timestamp-big-endian-byte-order",
            description:
                "timestamp 16909060 (0x01020304) — asserts BIG-endian byte order explicitly: the bytes must read 01020304, not 04030201",
            input: { v: 2, m: MERCHANT_ALT, t: 0x01_02_03_04, c: CLIENT },
        }),

        // ── Group 3: case canonicalisation ───────────────────────────────
        buildEncodeFixture({
            name: "uppercase-uuid-normalised",
            description:
                "UPPERCASE merchant and client UUIDs — the codec NORMALISES rather than rejects: its UUID regex is case-insensitive, so these bytes are byte-identical to the lowercase c-only fixture at the same timestamp, and decode always emits lower-case canonical 8-4-4-4-12 form",
            input: {
                v: 2,
                m: MERCHANT.toUpperCase(),
                t: TS_NORMAL,
                c: CLIENT.toUpperCase(),
            },
        }),
        buildEncodeFixture({
            name: "mixed-case-wallet-normalised",
            description:
                "mixed-case (EIP-55-looking) wallet address — accepted without checksum validation and normalised to lower-case hex on decode",
            input: { v: 2, m: MERCHANT, t: TS_NORMAL, w: WALLET_MIXED_CASE },
        }),

        // ── Group 4: extreme byte patterns ───────────────────────────────
        buildEncodeFixture({
            name: "all-zero-fields",
            description:
                "all-zero merchant UUID, timestamp 0 and all-zero client UUID — every payload byte after the header is 00, which catches implementations that skip writing zero fields",
            input: { v: 2, m: UUID_ZERO, t: TS_MIN, c: UUID_ZERO },
        }),
        buildEncodeFixture({
            name: "all-ones-fields",
            description:
                "all-ff UUIDs, uint32-max timestamp and all-ff wallet — every payload byte after the header is ff, the maximal 57-byte payload",
            input: {
                v: 2,
                m: UUID_MAX,
                t: TS_MAX,
                c: UUID_MAX,
                w: WALLET_MAX,
            },
        }),

        // ── Group 5: encode-direction rejections ─────────────────────────
        buildEncodeRejectFixture({
            name: "reject-encode-merchant-not-uuid",
            description: "merchant id is not a UUID",
            reason: "m fails the RFC-4122 shape check",
            input: { v: 2, m: "not-a-uuid", t: TS_NORMAL, c: CLIENT },
        }),
        buildEncodeRejectFixture({
            name: "reject-encode-client-not-uuid",
            description: "client id is a non-empty string but not a UUID",
            reason: "c is present (non-empty) but fails the UUID shape check",
            input: { v: 2, m: MERCHANT, t: TS_NORMAL, c: "not-a-uuid" },
        }),
        buildEncodeRejectFixture({
            name: "reject-encode-wallet-malformed",
            description: "wallet address is not 0x + 40 hex characters",
            reason: "w fails isAddress and, with no c, the context has no identifier",
            input: { v: 2, m: MERCHANT, t: TS_NORMAL, w: "0xnot-a-wallet" },
        }),
        buildEncodeRejectFixture({
            name: "reject-encode-wallet-too-short",
            description:
                "wallet address is valid hex but only 39 characters long",
            reason: "w is the right shape but the wrong length",
            input: {
                v: 2,
                m: MERCHANT,
                t: TS_NORMAL,
                w: "0x123456789012345678901234567890123456789",
            },
        }),
        buildEncodeRejectFixture({
            name: "reject-encode-missing-both-c-and-w",
            description: "neither clientId nor wallet is present",
            reason: "a V2 context MUST carry at least one identifier",
            input: { v: 2, m: MERCHANT, t: TS_NORMAL },
        }),
        buildEncodeRejectFixture({
            name: "reject-encode-timestamp-negative",
            description: "timestamp is -1, below the uint32 range",
            reason: "t < 0",
            input: { v: 2, m: MERCHANT, t: -1, c: CLIENT },
        }),
        buildEncodeRejectFixture({
            name: "reject-encode-timestamp-overflow",
            description:
                "timestamp is 4294967296 (0x100000000), one past the uint32 range",
            reason: "t > 0xffffffff — note that 4294967295 is ACCEPTED, see timestamp-uint32-max",
            input: { v: 2, m: MERCHANT, t: 4_294_967_296, c: CLIENT },
        }),
        buildEncodeRejectFixture({
            name: "reject-encode-timestamp-fractional",
            description: "timestamp is 1.5, not an integer",
            reason: "t fails the integer check",
            input: { v: 2, m: MERCHANT, t: 1.5, c: CLIENT },
        }),

        // ── Group 6: decode-direction rejections ─────────────────────────
        buildDecodeRejectFixture({
            name: "reject-decode-empty-buffer",
            description: "zero-length buffer",
            reason: "shorter than the 21-byte header+merchant+timestamp minimum",
            inputHex: "",
        }),
        buildDecodeRejectFixture({
            name: "reject-decode-truncated-below-minimum",
            description:
                "the first 20 bytes of a valid c-only payload — below the fixed-field minimum",
            reason: "buffer shorter than header + merchant UUID + timestamp",
            inputHex: truncatedHex(cOnly, 20),
        }),
        buildDecodeRejectFixture({
            name: "reject-decode-truncated-one-byte-short",
            description:
                "a valid 37-byte c-only payload with its last byte removed (36 bytes)",
            reason: "length disagrees with the length implied by the header flags",
            inputHex: truncatedHex(cOnly, 36),
        }),
        buildDecodeRejectFixture({
            name: "reject-decode-one-byte-too-long",
            description:
                "a valid 37-byte c-only payload with one extra trailing 00 byte (38 bytes)",
            reason: "length disagrees with the header flags; trailing junk is not tolerated",
            inputHex: `${bytesToHex(encodeFrakContextV2(cOnly) as Uint8Array)}00`,
        }),
        buildDecodeRejectFixture({
            name: "reject-decode-wrong-version-nibble",
            description:
                "a valid c-only payload whose header version nibble is 3 instead of 2 (0x12 -> 0x13)",
            reason: "version nibble is not 2 — guards against future formats",
            inputHex: tamperedHeaderHex(cOnly, (h) => (h & 0xf0) | 0x03),
        }),
        buildDecodeRejectFixture({
            name: "reject-decode-version-nibble-v1",
            description:
                "a valid c-only payload whose header version nibble is 1 (0x12 -> 0x11)",
            reason: "V1 has no header byte at all, so a V2-shaped buffer claiming v1 is malformed",
            inputHex: tamperedHeaderHex(cOnly, (h) => (h & 0xf0) | 0x01),
        }),
        buildDecodeRejectFixture({
            name: "reject-decode-reserved-bits-set",
            description:
                "a valid c-only payload with reserved header bit 7 set (0x12 -> 0x92)",
            reason: "reserved bits 6-7 must be 0",
            inputHex: tamperedHeaderHex(cOnly, (h) => h | 0x80),
        }),
        buildDecodeRejectFixture({
            name: "reject-decode-no-flags-set",
            description:
                "a 37-byte payload whose header has both has_c and has_w cleared (0x12 -> 0x02)",
            reason: "a V2 payload must set at least one of has_c / has_w",
            inputHex: tamperedHeaderHex(cOnly, (h) => h & 0x0f),
        }),
        buildDecodeRejectFixture({
            name: "reject-decode-flags-disagree-with-length",
            description:
                "a 37-byte (c-only-sized) payload whose header claims has_w instead of has_c (0x12 -> 0x22)",
            reason: "flags imply 41 bytes but the buffer is 37 — the length check catches header/payload mismatch",
            inputHex: tamperedHeaderHex(cOnly, (h) => (h & 0xcf) | 0x20),
        }),
        buildDecodeRejectFixture({
            name: "reject-decode-v1-length-buffer",
            description:
                "a bare 20-byte V1 wallet-address payload — the V2 decoder MUST refuse it while the outer length-based decompressor reads it as a V1 context (see decompressesTo). This is the V1-vs-V2 disambiguation: V1 is exactly 20 bytes, V2 is 37/41/57, so the two sets never overlap",
            reason: "20 bytes is the V1 layout, below the V2 minimum",
            inputHex: WALLET.slice(2),
        }),

        // ── Group 7: decompress-direction rejections ─────────────────────
        buildDecompressRejectFixture({
            name: "reject-decompress-malformed-base64url",
            description:
                "a string containing characters outside the base64url alphabet",
            reason: "base64url decoding fails; decompress catches and returns nil",
            inputBase64url: "!!!not base64!!!",
        }),
        buildDecompressRejectFixture({
            name: "reject-decompress-valid-b64-wrong-length",
            description:
                "well-formed base64url that decodes to 8 bytes — neither the V1 20-byte length nor any V2 length",
            reason: "decoded byte length matches no known layout",
            inputBase64url: base64urlEncode(new Uint8Array(8)),
        }),
        buildDecompressRejectFixture({
            name: "reject-decompress-empty-string",
            description: "the empty string",
            reason: "empty input short-circuits to nil before decoding",
            inputBase64url: "",
        }),
    ];

    const names = fixtures.map((f) => f.name);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
        throw new Error(`Duplicate fixture names: ${duplicates.join(", ")}`);
    }

    const output = {
        // Bump if the byte layout in frakContextV2Codec.ts ever changes.
        // Consumers should assert this matches their own expected format
        // version.
        formatVersion: 1,
        fixtures,
    };

    const outPath = new URL(
        "../src/context/fixtures/golden-context.json",
        import.meta.url
    );
    await Bun.write(outPath, `${JSON.stringify(output, null, 4)}\n`);
    console.log(`Wrote ${fixtures.length} fixtures to ${outPath.pathname}`);
}

main();

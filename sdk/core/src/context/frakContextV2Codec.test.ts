import type { Address } from "viem";
import { describe, expect, it } from "../../tests/vitest-fixtures";
import type { FrakContext, FrakContextV2 } from "../types";
import { base64urlEncode } from "../utils/compression/b64";
import goldenContext from "./fixtures/golden-context.json";
import { FrakContextManager } from "./frakContext";
import { decodeFrakContextV2, encodeFrakContextV2 } from "./frakContextV2Codec";

const MERCHANT = "550e8400-e29b-41d4-a716-446655440000";
const CLIENT = "550e8400-e29b-41d4-a716-446655440001";
const WALLET = "0x1234567890123456789012345678901234567890" as Address;

const hexToBytes = (hex: string): Uint8Array => {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
};

const bytesToHex = (bytes: Uint8Array): string =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The JSON import is inferred as a union of per-entry literal shapes with
 * `kind` widened to `string`, so `Extract<…, { kind: "encode" }>` collapses to
 * `never`. Declare the corpus contract explicitly instead and widen the import
 * to it once — the predicates below then narrow from a real discriminated
 * union, which type-checks the payload fields rather than silencing them.
 */
type EncodeFixture = {
    name: string;
    description: string;
    kind: "encode";
    input: FrakContextV2;
    expected: {
        byteLength: number;
        hex: string;
        base64url: string;
        base64urlLength: number;
        decoded: FrakContextV2;
    };
};

type RejectFixture = {
    name: string;
    description: string;
    kind: "reject";
    direction: "encode" | "decode" | "decompress";
    reason: string;
    input?: unknown;
    inputHex?: string;
    inputBase64url?: string;
    expected: null;
    decompressesTo?: FrakContext | null;
};

type GoldenFixture = EncodeFixture | RejectFixture;

const allFixtures = goldenContext.fixtures as unknown as GoldenFixture[];

const encodeFixtures = allFixtures.filter(
    (f): f is EncodeFixture => f.kind === "encode"
);
const rejectFixtures = allFixtures.filter(
    (f): f is RejectFixture => f.kind === "reject"
);
const rejectsBy = (direction: RejectFixture["direction"]) =>
    rejectFixtures.filter((f) => f.direction === direction);

describe("golden context fixtures", () => {
    it("declares the expected envelope", () => {
        expect(goldenContext.formatVersion).toBe(1);
        expect(Array.isArray(goldenContext.fixtures)).toBe(true);
        expect(goldenContext.fixtures.length).toBeGreaterThan(0);
    });

    it("uses a unique name for every fixture", () => {
        const names = goldenContext.fixtures.map((f) => f.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it("covers every presence combination of c and w", () => {
        const lengths = new Set(
            encodeFixtures.map((f) => f.expected.byteLength)
        );
        // 37 = c only, 41 = w only, 57 = c + w.
        expect(lengths).toEqual(new Set([37, 41, 57]));
    });

    it("covers both uint32 timestamp boundaries and a normal value", () => {
        const timestamps = new Set(encodeFixtures.map((f) => f.input.t));
        expect(timestamps.has(0)).toBe(true);
        expect(timestamps.has(4_294_967_295)).toBe(true);
        expect(timestamps.has(1_709_654_400)).toBe(true);
    });

    it("carries negative vectors for all three directions", () => {
        expect(rejectsBy("encode").length).toBeGreaterThan(0);
        expect(rejectsBy("decode").length).toBeGreaterThan(0);
        expect(rejectsBy("decompress").length).toBeGreaterThan(0);
    });

    it.each(encodeFixtures)("encodes to the frozen bytes: $name", (fixture) => {
        const encoded = encodeFrakContextV2(fixture.input);
        expect(encoded).toBeInstanceOf(Uint8Array);
        const bytes = encoded as Uint8Array;

        expect(bytes.length).toBe(fixture.expected.byteLength);
        expect(bytesToHex(bytes)).toBe(fixture.expected.hex);
        expect(base64urlEncode(bytes)).toBe(fixture.expected.base64url);
        expect(base64urlEncode(bytes).length).toBe(
            fixture.expected.base64urlLength
        );
        // base64url is unpadded and uses the URL-safe alphabet only.
        expect(fixture.expected.base64url).toMatch(/^[A-Za-z0-9_-]*$/);
    });

    it.each(encodeFixtures)(
        "decodes the frozen bytes back to the expected context: $name",
        (fixture) => {
            const decoded = decodeFrakContextV2(
                hexToBytes(fixture.expected.hex)
            );
            expect(decoded).toEqual(fixture.expected.decoded);
        }
    );

    it.each(encodeFixtures)(
        "round-trips the frozen base64url through the context manager: $name",
        (fixture) => {
            expect(FrakContextManager.compress(fixture.input)).toBe(
                fixture.expected.base64url
            );
            expect(
                FrakContextManager.decompress(fixture.expected.base64url)
            ).toEqual(fixture.expected.decoded);
        }
    );

    it.each(rejectsBy("encode"))("rejects on encode: $name", (fixture) => {
        expect(encodeFrakContextV2(fixture.input as FrakContextV2)).toBeNull();
    });

    it.each(rejectsBy("decode"))("rejects on decode: $name", (fixture) => {
        const bytes = hexToBytes(fixture.inputHex as string);
        expect(decodeFrakContextV2(bytes)).toBeNull();

        // The outer, length-based decoder must agree with the frozen
        // expectation — this is what pins V1-vs-V2 disambiguation.
        const outer =
            FrakContextManager.decompress(base64urlEncode(bytes)) ?? null;
        expect(outer).toEqual(fixture.decompressesTo ?? null);
    });

    it.each(rejectsBy("decompress"))(
        "rejects on decompress: $name",
        (fixture) => {
            expect(
                FrakContextManager.decompress(fixture.inputBase64url as string)
            ).toBeUndefined();
        }
    );

    it("proves uppercase UUID input normalises rather than diverging", () => {
        const upper = encodeFixtures.find(
            (f) => f.name === "uppercase-uuid-normalised"
        );
        const lower = encodeFixtures.find((f) => f.name === "c-only");
        expect(upper).toBeDefined();
        expect(lower).toBeDefined();
        // Same bytes as the lowercase fixture: the codec normalises, it does
        // not reject, and it does not emit different bytes for either casing.
        expect(upper?.expected.hex).toBe(lower?.expected.hex);
        expect(/[A-Z]/.test(upper?.input.m ?? "")).toBe(true);
        expect(upper?.expected.decoded.m).toBe(
            (upper?.input.m ?? "").toLowerCase()
        );
    });

    it("proves a V1-length buffer is refused by V2 but read as V1 by the outer decoder", () => {
        const v1 = rejectFixtures.find(
            (f) => f.name === "reject-decode-v1-length-buffer"
        );
        expect(v1).toBeDefined();
        const bytes = hexToBytes(v1?.inputHex as string);
        expect(bytes.length).toBe(20);
        expect(decodeFrakContextV2(bytes)).toBeNull();
        expect(v1?.decompressesTo).toEqual({ r: WALLET });
    });
});

describe("frakContextV2Codec", () => {
    describe("encodeFrakContextV2 / decodeFrakContextV2 round-trip", () => {
        it("round-trips a context with clientId only (37 bytes)", () => {
            const ctx: FrakContextV2 = {
                v: 2,
                m: MERCHANT,
                t: 1709654400,
                c: CLIENT,
            };
            const encoded = encodeFrakContextV2(ctx);
            expect(encoded).toBeInstanceOf(Uint8Array);
            expect(encoded?.length).toBe(37);
            expect(decodeFrakContextV2(encoded as Uint8Array)).toEqual(ctx);
        });

        it("round-trips a context with wallet only (41 bytes)", () => {
            const ctx: FrakContextV2 = {
                v: 2,
                m: MERCHANT,
                t: 1709654400,
                w: WALLET,
            };
            const encoded = encodeFrakContextV2(ctx);
            expect(encoded?.length).toBe(41);
            expect(decodeFrakContextV2(encoded as Uint8Array)).toEqual(ctx);
        });

        it("round-trips a context with clientId + wallet (57 bytes)", () => {
            const ctx: FrakContextV2 = {
                v: 2,
                m: MERCHANT,
                t: 1709654400,
                c: CLIENT,
                w: WALLET,
            };
            const encoded = encodeFrakContextV2(ctx);
            expect(encoded?.length).toBe(57);
            expect(decodeFrakContextV2(encoded as Uint8Array)).toEqual(ctx);
        });

        it("produces a base64url string shorter than the legacy JSON format", () => {
            // Legacy reference: a typical anonymous context is ~115 JSON bytes
            // \u2192 ~154 base64url chars. Wallet variant is ~165 \u2192 ~220 chars.
            const ctxBoth: FrakContextV2 = {
                v: 2,
                m: MERCHANT,
                t: 1709654400,
                c: CLIENT,
                w: WALLET,
            };
            const encoded = base64urlEncode(
                encodeFrakContextV2(ctxBoth) as Uint8Array
            );
            // 57 bytes encodes to 76 chars (no padding).
            expect(encoded.length).toBe(76);
            // Sanity: far below the legacy ~220-char payload.
            expect(encoded.length).toBeLessThan(100);
        });

        it("preserves UUID case insensitivity on decode", () => {
            const ctx: FrakContextV2 = {
                v: 2,
                m: MERCHANT.toUpperCase(),
                t: 1,
                c: CLIENT,
            };
            const encoded = encodeFrakContextV2(ctx);
            const decoded = decodeFrakContextV2(encoded as Uint8Array);
            // Decoded UUIDs are lower-case canonical.
            expect(decoded?.m).toBe(MERCHANT);
        });

        it("preserves timestamp at the uint32 boundary", () => {
            const ctx: FrakContextV2 = {
                v: 2,
                m: MERCHANT,
                t: 0xff_ff_ff_ff,
                c: CLIENT,
            };
            const decoded = decodeFrakContextV2(
                encodeFrakContextV2(ctx) as Uint8Array
            );
            expect(decoded?.t).toBe(0xff_ff_ff_ff);
        });
    });

    describe("encodeFrakContextV2 validation", () => {
        it("rejects non-UUID merchant id", () => {
            expect(
                encodeFrakContextV2({
                    v: 2,
                    m: "not-a-uuid",
                    t: 1,
                    c: CLIENT,
                })
            ).toBeNull();
        });

        it("rejects non-UUID client id", () => {
            expect(
                encodeFrakContextV2({
                    v: 2,
                    m: MERCHANT,
                    t: 1,
                    c: "not-a-uuid",
                })
            ).toBeNull();
        });

        it("rejects malformed wallet address", () => {
            expect(
                encodeFrakContextV2({
                    v: 2,
                    m: MERCHANT,
                    t: 1,
                    w: "0xnot-a-wallet" as Address,
                })
            ).toBeNull();
        });

        it("rejects contexts missing both c and w", () => {
            expect(
                encodeFrakContextV2({
                    v: 2,
                    m: MERCHANT,
                    t: 1,
                } as FrakContextV2)
            ).toBeNull();
        });

        it("rejects timestamps outside uint32 range", () => {
            expect(
                encodeFrakContextV2({
                    v: 2,
                    m: MERCHANT,
                    t: -1,
                    c: CLIENT,
                })
            ).toBeNull();
            expect(
                encodeFrakContextV2({
                    v: 2,
                    m: MERCHANT,
                    t: 0x1_00_00_00_00,
                    c: CLIENT,
                })
            ).toBeNull();
            expect(
                encodeFrakContextV2({
                    v: 2,
                    m: MERCHANT,
                    t: 1.5,
                    c: CLIENT,
                })
            ).toBeNull();
        });
    });

    describe("decodeFrakContextV2 validation", () => {
        it("returns null on wrong version nibble", () => {
            const encoded = encodeFrakContextV2({
                v: 2,
                m: MERCHANT,
                t: 1,
                c: CLIENT,
            }) as Uint8Array;
            const tampered = new Uint8Array(encoded);
            tampered[0] = (tampered[0] & 0xf0) | 0x03; // flip version to 3
            expect(decodeFrakContextV2(tampered)).toBeNull();
        });

        it("returns null when reserved header bits are set", () => {
            const encoded = encodeFrakContextV2({
                v: 2,
                m: MERCHANT,
                t: 1,
                c: CLIENT,
            }) as Uint8Array;
            const tampered = new Uint8Array(encoded);
            tampered[0] |= 0x80;
            expect(decodeFrakContextV2(tampered)).toBeNull();
        });

        it("returns null when neither flag is set", () => {
            const encoded = encodeFrakContextV2({
                v: 2,
                m: MERCHANT,
                t: 1,
                c: CLIENT,
            }) as Uint8Array;
            const tampered = new Uint8Array(encoded);
            tampered[0] &= 0x0f; // clear flags, keep version
            expect(decodeFrakContextV2(tampered)).toBeNull();
        });

        it("returns null when byte length disagrees with flags", () => {
            const encoded = encodeFrakContextV2({
                v: 2,
                m: MERCHANT,
                t: 1,
                c: CLIENT,
            }) as Uint8Array;
            // Drop the trailing byte to break the expected length.
            const truncated = encoded.subarray(0, encoded.length - 1);
            expect(decodeFrakContextV2(truncated)).toBeNull();
        });

        it("returns null on an empty buffer", () => {
            expect(decodeFrakContextV2(new Uint8Array(0))).toBeNull();
        });
    });
});

import type { Address } from "viem";
import { describe, expect, it } from "../../tests/vitest-fixtures";
import type { FrakContextV2 } from "../types";
import { base64urlEncode } from "./compression/b64";
import {
    decodeFrakContextV2,
    encodeFrakContextV2,
    isV2BinaryLength,
} from "./frakContextV2Codec";

const MERCHANT = "550e8400-e29b-41d4-a716-446655440000";
const CLIENT = "550e8400-e29b-41d4-a716-446655440001";
const WALLET = "0x1234567890123456789012345678901234567890" as Address;

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

    describe("isV2BinaryLength", () => {
        it("matches exactly the three valid V2 sizes", () => {
            expect(isV2BinaryLength(37)).toBe(true);
            expect(isV2BinaryLength(41)).toBe(true);
            expect(isV2BinaryLength(57)).toBe(true);
        });

        it("rejects V1 size and everything else", () => {
            expect(isV2BinaryLength(20)).toBe(false);
            expect(isV2BinaryLength(0)).toBe(false);
            expect(isV2BinaryLength(36)).toBe(false);
            expect(isV2BinaryLength(58)).toBe(false);
        });
    });
});

import { describe, expect, it } from "vitest";
import {
    base64UrlToBytes,
    buildProofMessage,
    bytesToBase64Url,
    decodeProof,
    deriveClientIdFromHash,
    encodeProof,
    uuidToBytes,
} from "./canonical";
import goldenProofs from "./fixtures/golden-proofs.json";
import type { ProofEnvelope } from "./types";

const hexToBytes = (hex: string): Uint8Array => {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
};

const bytesToHex = (bytes: Uint8Array): string =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
    const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return new Uint8Array(digest);
}

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const ANONYMOUS_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45";

describe("golden fixtures", () => {
    it("has at least two distinct keypairs and covers all four ops", () => {
        const privkeys = new Set(
            goldenProofs.fixtures.map((f) => f.privkeyHex)
        );
        const ops = new Set(goldenProofs.fixtures.map((f) => f.op));
        expect(privkeys.size).toBeGreaterThanOrEqual(2);
        expect(ops).toEqual(
            new Set([
                "frak-merge-v1",
                "frak-ensure-v1",
                "frak-install-v1",
                "frak-sso-v1",
            ])
        );
    });

    it("includes a merge case with a real non-empty binding", () => {
        const mergeFixture = goldenProofs.fixtures.find(
            (f) => f.op === "frak-merge-v1" && f.bindingHex.length > 0
        );
        expect(mergeFixture).toBeDefined();
        expect(mergeFixture?.bindingHex).toHaveLength(64); // 32 bytes
    });

    it("includes an uppercase merchantId input parsed to the same bytes as lowercase", () => {
        const upperFixture = goldenProofs.fixtures.find((f) =>
            /[A-Z]/.test(f.merchantId)
        );
        expect(upperFixture).toBeDefined();
    });

    it.each(goldenProofs.fixtures)(
        "reproduces canonicalMsgHex and derivedClientId for: $description",
        async (fixture) => {
            const msg = buildProofMessage({
                op: fixture.op as
                    | "frak-merge-v1"
                    | "frak-ensure-v1"
                    | "frak-install-v1",
                merchantId: fixture.merchantId,
                anonymousId: fixture.anonymousId,
                binding: hexToBytes(fixture.bindingHex),
                ts: fixture.ts,
            });
            expect(bytesToHex(msg)).toBe(fixture.canonicalMsgHex);

            const pubkey = hexToBytes(fixture.pubkeyUncompressedHex);
            const hash = await sha256(pubkey);
            expect(deriveClientIdFromHash(hash)).toBe(fixture.derivedClientId);
        }
    );

    it("re-encodes the fixture proof envelope identically", () => {
        for (const fixture of goldenProofs.fixtures) {
            const envelope: ProofEnvelope = {
                v: 1,
                pk: hexToBytes(fixture.pubkeyUncompressedHex),
                ts: fixture.ts,
                sig: hexToBytes(fixture.sigHex),
            };
            expect(encodeProof(envelope)).toBe(fixture.proof);
        }
    });
});

describe("buildProofMessage", () => {
    it("produces a message of exactly op.length + 72 bytes (16+16+32+8, no length prefixes)", () => {
        const op = "frak-ensure-v1";
        const msg = buildProofMessage({
            op,
            merchantId: MERCHANT_ID,
            anonymousId: ANONYMOUS_ID,
            binding: new Uint8Array(0),
            ts: 0,
        });
        expect(msg.length).toBe(op.length + 72);
    });

    it("places the op ascii prefix, merchantId and anonymousId at their fixed offsets", () => {
        const op = "frak-ensure-v1";
        const msg = buildProofMessage({
            op,
            merchantId: MERCHANT_ID,
            anonymousId: ANONYMOUS_ID,
            binding: new Uint8Array(0),
            ts: 0,
        });

        expect(new TextDecoder().decode(msg.slice(0, op.length))).toBe(op);

        const merchantBytes = msg.slice(op.length, op.length + 16);
        expect(Array.from(merchantBytes)).toEqual(
            Array.from(uuidToBytes(MERCHANT_ID, "merchantId"))
        );

        const anonymousBytes = msg.slice(op.length + 16, op.length + 32);
        expect(Array.from(anonymousBytes)).toEqual(
            Array.from(uuidToBytes(ANONYMOUS_ID, "anonymousId"))
        );
    });

    it("writes ts as an 8-byte big-endian unsigned integer at the tail, no length prefix", () => {
        const msg = buildProofMessage({
            op: "frak-ensure-v1",
            merchantId: MERCHANT_ID,
            anonymousId: ANONYMOUS_ID,
            binding: new Uint8Array(0),
            ts: 1_700_000_000,
        });
        const tsBytes = msg.slice(msg.length - 8);
        expect(bytesToHex(tsBytes)).toBe("000000006553f100");
    });

    it("writes an empty binding as 32 zero bytes, immediately preceding ts", () => {
        const msg = buildProofMessage({
            op: "frak-install-v1",
            merchantId: MERCHANT_ID,
            anonymousId: ANONYMOUS_ID,
            binding: new Uint8Array(0),
            ts: 0,
        });
        // binding occupies the 32 bytes immediately before the trailing 8-byte ts.
        const bindingBytes = msg.slice(msg.length - 40, msg.length - 8);
        expect(bindingBytes.length).toBe(32);
        expect(Array.from(bindingBytes)).toEqual(new Array(32).fill(0));
    });

    it("writes a real 32-byte binding verbatim at the same fixed offset", () => {
        const binding = new Uint8Array(32).fill(0xab);
        const msg = buildProofMessage({
            op: "frak-merge-v1",
            merchantId: MERCHANT_ID,
            anonymousId: ANONYMOUS_ID,
            binding,
            ts: 0,
        });
        const bindingBytes = msg.slice(msg.length - 40, msg.length - 8);
        expect(Array.from(bindingBytes)).toEqual(Array.from(binding));
    });

    it("produces identical bytes for uppercase and lowercase UUID input", () => {
        const lower = buildProofMessage({
            op: "frak-ensure-v1",
            merchantId: MERCHANT_ID,
            anonymousId: ANONYMOUS_ID,
            binding: new Uint8Array(0),
            ts: 0,
        });
        const upper = buildProofMessage({
            op: "frak-ensure-v1",
            merchantId: MERCHANT_ID.toUpperCase(),
            anonymousId: ANONYMOUS_ID.toUpperCase(),
            binding: new Uint8Array(0),
            ts: 0,
        });
        expect(bytesToHex(upper)).toBe(bytesToHex(lower));
    });

    it("throws on a non-UUID merchantId/anonymousId", () => {
        expect(() =>
            buildProofMessage({
                op: "frak-ensure-v1",
                merchantId: "not-a-uuid",
                anonymousId: ANONYMOUS_ID,
                binding: new Uint8Array(0),
                ts: 0,
            })
        ).toThrow();

        expect(() =>
            buildProofMessage({
                op: "frak-ensure-v1",
                merchantId: MERCHANT_ID,
                anonymousId: "also-not-a-uuid",
                binding: new Uint8Array(0),
                ts: 0,
            })
        ).toThrow();
    });

    it.each([31, 33, 1, 16])(
        "throws when binding is neither empty nor 32 bytes (got %i)",
        (len) => {
            expect(() =>
                buildProofMessage({
                    op: "frak-merge-v1",
                    merchantId: MERCHANT_ID,
                    anonymousId: ANONYMOUS_ID,
                    binding: new Uint8Array(len),
                    ts: 0,
                })
            ).toThrow();
        }
    );
});

describe("uuidToBytes", () => {
    it("parses a UUID into 16 raw bytes", () => {
        const bytes = uuidToBytes(MERCHANT_ID, "merchantId");
        expect(bytes.length).toBe(16);
        expect(bytesToHex(bytes)).toBe(MERCHANT_ID.replace(/-/g, ""));
    });

    it("produces identical bytes regardless of input case", () => {
        const lower = uuidToBytes(MERCHANT_ID, "merchantId");
        const upper = uuidToBytes(MERCHANT_ID.toUpperCase(), "merchantId");
        expect(Array.from(lower)).toEqual(Array.from(upper));
    });

    it("throws with the given label on malformed input", () => {
        expect(() => uuidToBytes("not-a-uuid", "someField")).toThrow(
            /someField/
        );
    });
});

describe("deriveClientIdFromHash", () => {
    it("sets RFC-4122 version (0x40) and variant (0x80) bits", () => {
        const hash = new Uint8Array(32).fill(0xff);
        const id = deriveClientIdFromHash(hash);
        const bytes = hexToBytes(id.replace(/-/g, ""));
        expect(bytes[6] & 0xf0).toBe(0x40);
        expect(bytes[8] & 0xc0).toBe(0x80);
    });

    it("produces a syntactically valid, lowercase, hyphenated UUID", () => {
        const hash = new Uint8Array(32).fill(0x00);
        const id = deriveClientIdFromHash(hash);
        expect(id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
    });

    it("only uses the first 16 bytes of the hash", () => {
        const hashA = new Uint8Array(32).fill(0x11);
        const hashB = new Uint8Array(32).fill(0x11);
        hashB[20] = 0xff; // only affects bytes beyond the first 16
        expect(deriveClientIdFromHash(hashA)).toBe(
            deriveClientIdFromHash(hashB)
        );
    });
});

describe("base64url helpers", () => {
    it("round-trips arbitrary bytes without padding characters", () => {
        const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
        const encoded = bytesToBase64Url(bytes);
        expect(encoded).not.toMatch(/[+/=]/);
        expect(Array.from(base64UrlToBytes(encoded))).toEqual(
            Array.from(bytes)
        );
    });
});

describe("encodeProof / decodeProof", () => {
    it("round-trips an envelope", () => {
        const envelope: ProofEnvelope = {
            v: 1,
            pk: new Uint8Array(65).fill(4),
            ts: 1_700_000_000,
            sig: new Uint8Array(64).fill(9),
        };
        const wire = encodeProof(envelope);
        const decoded = decodeProof(wire);
        expect(decoded).not.toBeNull();
        expect(decoded?.v).toBe(1);
        expect(decoded?.ts).toBe(envelope.ts);
        expect(Array.from(decoded?.pk ?? [])).toEqual(Array.from(envelope.pk));
        expect(Array.from(decoded?.sig ?? [])).toEqual(
            Array.from(envelope.sig)
        );
    });

    it("encodes exactly 138 raw bytes (1 version + 65 pk + 8 ts + 64 sig) before base64url", () => {
        const envelope: ProofEnvelope = {
            v: 1,
            pk: new Uint8Array(65).fill(1),
            ts: 0,
            sig: new Uint8Array(64).fill(2),
        };
        const wire = encodeProof(envelope);
        expect(base64UrlToBytes(wire).length).toBe(138);
    });

    it("throws when pk is not 65 bytes", () => {
        expect(() =>
            encodeProof({
                v: 1,
                pk: new Uint8Array(64),
                ts: 0,
                sig: new Uint8Array(64),
            })
        ).toThrow();
        expect(() =>
            encodeProof({
                v: 1,
                pk: new Uint8Array(66),
                ts: 0,
                sig: new Uint8Array(64),
            })
        ).toThrow();
    });

    it("throws when sig is not 64 bytes", () => {
        expect(() =>
            encodeProof({
                v: 1,
                pk: new Uint8Array(65),
                ts: 0,
                sig: new Uint8Array(63),
            })
        ).toThrow();
        expect(() =>
            encodeProof({
                v: 1,
                pk: new Uint8Array(65),
                ts: 0,
                sig: new Uint8Array(65),
            })
        ).toThrow();
    });

    it.each([
        ["empty string", ""],
        ["not base64url", "!!!not-valid-base64!!!"],
        [
            "correct-length garbage but wrong version byte",
            bytesToBase64Url(
                (() => {
                    const b = new Uint8Array(138);
                    b[0] = 2; // only version 1 is recognised
                    return b;
                })()
            ),
        ],
        ["too-short byte payload", bytesToBase64Url(new Uint8Array(137))],
        ["too-long byte payload", bytesToBase64Url(new Uint8Array(139))],
        ["single arbitrary byte", bytesToBase64Url(new Uint8Array([1, 2, 3]))],
    ])("returns null, never throws, on: %s", (_label, garbage) => {
        expect(() => decodeProof(garbage)).not.toThrow();
        expect(decodeProof(garbage)).toBeNull();
    });
});

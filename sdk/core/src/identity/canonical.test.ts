import { describe, expect, it } from "vitest";
import {
    base64UrlToBytes,
    buildProofMessage,
    bytesToBase64Url,
    decodeProof,
    deriveClientIdFromHash,
    encodeProof,
    normalizeUuid,
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

describe("golden fixtures", () => {
    it("has at least two distinct keypairs and covers all three ops", () => {
        const privkeys = new Set(
            goldenProofs.fixtures.map((f) => f.privkeyHex)
        );
        const ops = new Set(goldenProofs.fixtures.map((f) => f.op));
        expect(privkeys.size).toBeGreaterThanOrEqual(2);
        expect(ops).toEqual(
            new Set(["frak-merge-v1", "frak-ensure-v1", "frak-install-v1"])
        );
    });

    it("includes a merge case with a real non-empty binding", () => {
        const mergeFixture = goldenProofs.fixtures.find(
            (f) => f.op === "frak-merge-v1" && f.bindingHex.length > 0
        );
        expect(mergeFixture).toBeDefined();
        expect(mergeFixture?.bindingHex).toHaveLength(64); // 32 bytes
    });

    it("includes an uppercase merchantId input normalised to lowercase", () => {
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
    it("length-prefixes merchantId and anonymousId with uint16be", () => {
        const msg = buildProofMessage({
            op: "frak-ensure-v1",
            merchantId: "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e",
            anonymousId: "256b1be3-2745-41d1-89d4-9121cc87bc45",
            binding: new Uint8Array(0),
            ts: 0,
        });
        const prefixLen = "frak-ensure-v1".length;
        // uint16be(36) === 0x0024
        expect(msg[prefixLen]).toBe(0x00);
        expect(msg[prefixLen + 1]).toBe(0x24);
    });

    it("writes ts as an 8-byte big-endian unsigned integer, no length prefix", () => {
        const msg = buildProofMessage({
            op: "frak-ensure-v1",
            merchantId: "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e",
            anonymousId: "256b1be3-2745-41d1-89d4-9121cc87bc45",
            binding: new Uint8Array(0),
            ts: 1_700_000_000,
        });
        const tsBytes = msg.slice(msg.length - 8);
        expect(bytesToHex(tsBytes)).toBe("000000006553f100");
    });

    it("writes a zero-length binding field for ensure/install (uint16be(0), no payload)", () => {
        const msg = buildProofMessage({
            op: "frak-install-v1",
            merchantId: "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e",
            anonymousId: "256b1be3-2745-41d1-89d4-9121cc87bc45",
            binding: new Uint8Array(0),
            ts: 0,
        });
        // Binding field immediately precedes the 8-byte ts at the tail.
        const bindingLenBytes = msg.slice(msg.length - 10, msg.length - 8);
        expect(Array.from(bindingLenBytes)).toEqual([0, 0]);
    });

    it("normalises an uppercase UUID to lowercase before building the message", () => {
        const lower = buildProofMessage({
            op: "frak-ensure-v1",
            merchantId: "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e",
            anonymousId: "256b1be3-2745-41d1-89d4-9121cc87bc45",
            binding: new Uint8Array(0),
            ts: 0,
        });
        const upper = buildProofMessage({
            op: "frak-ensure-v1",
            merchantId: "9C8B3E2A-1D4F-4A6B-8E2D-7F3A1B5C9D0E",
            anonymousId: "256B1BE3-2745-41D1-89D4-9121CC87BC45",
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
                anonymousId: "256b1be3-2745-41d1-89d4-9121cc87bc45",
                binding: new Uint8Array(0),
                ts: 0,
            })
        ).toThrow();
    });
});

describe("normalizeUuid", () => {
    it("lowercases an uppercase UUID", () => {
        expect(normalizeUuid("9C8B3E2A-1D4F-4A6B-8E2D-7F3A1B5C9D0E")).toBe(
            "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
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

    it.each([
        ["empty string", ""],
        ["not base64url", "!!!not-valid-base64!!!"],
        [
            "valid base64url but not JSON",
            bytesToBase64Url(new Uint8Array([1, 2, 3])),
        ],
        [
            "valid JSON but wrong shape",
            bytesToBase64Url(
                new TextEncoder().encode(JSON.stringify({ foo: 1 }))
            ),
        ],
        [
            "valid JSON, missing sig",
            bytesToBase64Url(
                new TextEncoder().encode(
                    JSON.stringify({ v: 1, pk: "abc", ts: 1 })
                )
            ),
        ],
        [
            "wrong version",
            bytesToBase64Url(
                new TextEncoder().encode(
                    JSON.stringify({ v: 2, pk: "abc", ts: 1, sig: "def" })
                )
            ),
        ],
    ])("returns null, never throws, on: %s", (_label, garbage) => {
        expect(() => decodeProof(garbage)).not.toThrow();
        expect(decodeProof(garbage)).toBeNull();
    });
});

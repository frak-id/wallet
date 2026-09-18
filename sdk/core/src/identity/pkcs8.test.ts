import { p256 } from "@noble/curves/nist.js";
import { describe, expect, it } from "vitest";
import { toPkcs8 } from "./sign";

const SCALAR_BYTES = 32;
const UNCOMPRESSED_POINT_BYTES = 65;
const TAGGED_TYPE_1 = 0xa1;

/**
 * `CryptoKeyEC::platformImportPkcs8`, from WebKit's `crypto/cocoa`, as an
 * oracle. Node's OpenSSL accepts blobs WebKit rejects — including one carrying
 * no public key at all — so `importKey` passing here proves nothing about
 * Safari, and only this walk can guard the encoding.
 */
function webkitImportPkcs8(key: Uint8Array): {
    scalar: Uint8Array;
    point: Uint8Array;
} {
    const lengthBytes = (byte: number) => (byte <= 127 ? 1 : (byte & 0x7f) + 1);
    const need = (size: number) => {
        if (key.length < size) throw new Error("PKCS#8 truncated for WebKit");
    };

    let index = 1;
    need(index + 1);
    index += lengthBytes(key[index]) + 4;
    need(index + 1);
    index += lengthBytes(key[index]);

    need(index + 9);
    index += 9;
    need(index + 10);
    index += 10 + 1;

    need(index + 1);
    index += lengthBytes(key[index]) + 1;
    need(index + 1);
    index += lengthBytes(key[index]) + 4;
    need(index + 1);
    index += lengthBytes(key[index]);

    need(index + SCALAR_BYTES);
    const scalarAt = index;
    index += SCALAR_BYTES;

    if (key[index] !== TAGGED_TYPE_1) {
        throw new Error("PKCS#8 carries no [1] publicKey for WebKit");
    }
    index += 1;
    need(index + 1);
    index += lengthBytes(key[index]) + 1;
    need(index + 1);
    index += lengthBytes(key[index]) + 1;
    need(index);

    const point = key.slice(index);
    if (point.length !== UNCOMPRESSED_POINT_BYTES) {
        throw new Error(`WebKit point size mismatch: ${point.length}`);
    }
    return { scalar: key.slice(scalarAt, scalarAt + SCALAR_BYTES), point };
}

describe("toPkcs8", () => {
    const secretKey = p256.utils.randomSecretKey();
    const publicKey = p256.getPublicKey(secretKey, false);

    it("emits a fixed-size P-256 PrivateKeyInfo", () => {
        expect(toPkcs8(secretKey, publicKey)).toHaveLength(138);
    });

    it("declares ASN.1 lengths that match the payload", () => {
        const key = toPkcs8(secretKey, publicKey);

        expect([key[0], key[1], key[2]]).toEqual([0x30, 0x81, 0x87]);
        expect(key[2] + 3).toBe(key.length);
        expect([key[27], key[28]]).toEqual([0x04, 0x6d]);
        expect([key[29], key[30]]).toEqual([0x30, 0x6b]);
        expect([key[68], key[69]]).toEqual([TAGGED_TYPE_1, 0x44]);
        expect([key[70], key[71], key[72]]).toEqual([0x03, 0x42, 0x00]);
    });

    it("survives WebKit's parser, which cannot derive the point itself", () => {
        const parsed = webkitImportPkcs8(toPkcs8(secretKey, publicKey));

        expect(parsed.scalar).toEqual(secretKey);
        expect(parsed.point).toEqual(publicKey);
    });

    it("is rejected by that parser once the [1] publicKey is dropped", () => {
        // The shape @noble/curves emits, and the production bug it caused.
        const minimal = toPkcs8(secretKey, publicKey).slice(0, 68);

        expect(() => webkitImportPkcs8(minimal)).toThrow(/no \[1\] publicKey/);
    });
});

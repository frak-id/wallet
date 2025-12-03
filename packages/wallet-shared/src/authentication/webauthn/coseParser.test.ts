import { describe, expect, it } from "vitest";
import {
    extractPublicKeyFromAttestationObject,
    parseCosePublicKey,
} from "./coseParser";

describe("coseParser", () => {
    describe("parseCosePublicKey", () => {
        it("should parse a valid P-256 COSE key", () => {
            // This is a minimal CBOR-encoded COSE EC2 P-256 key
            // Map with 5 entries:
            // 1 (kty) => 2 (EC2)
            // 3 (alg) => -7 (ES256)
            // -1 (crv) => 1 (P-256)
            // -2 (x) => 32 bytes
            // -3 (y) => 32 bytes
            const xCoord = new Uint8Array(32).fill(0x01);
            const yCoord = new Uint8Array(32).fill(0x02);

            // Build CBOR map manually:
            // A5 = map with 5 items
            // 01 02 = kty: 2 (EC2)
            // 03 26 = alg: -7 (ES256, encoded as negative int: -7 = ~6 = 0x26 in CBOR)
            // 20 01 = crv: 1 (P-256, -1 encoded as 0x20)
            // 21 58 20 <32 bytes> = x coordinate (0x21 = -2, 0x58 0x20 = byte string of 32 bytes)
            // 22 58 20 <32 bytes> = y coordinate (0x22 = -3, 0x58 0x20 = byte string of 32 bytes)
            const coseKey = new Uint8Array([
                0xa5, // Map with 5 items
                0x01,
                0x02, // kty: 2 (EC2)
                0x03,
                0x26, // alg: -7 (ES256)
                0x20,
                0x01, // crv: 1 (P-256)
                0x21,
                0x58,
                0x20, // x: byte string of 32 bytes
                ...xCoord,
                0x22,
                0x58,
                0x20, // y: byte string of 32 bytes
                ...yCoord,
            ]);

            const result = parseCosePublicKey(coseKey);

            expect(result.x).toEqual(xCoord);
            expect(result.y).toEqual(yCoord);
        });

        it("should throw for non-EC2 key types", () => {
            // CBOR map with kty: 1 (OKP instead of EC2)
            const invalidKey = new Uint8Array([
                0xa1, // Map with 1 item
                0x01,
                0x01, // kty: 1 (OKP)
            ]);

            expect(() => parseCosePublicKey(invalidKey)).toThrow(
                "COSE key is not EC2"
            );
        });

        it("should throw for missing coordinates", () => {
            // CBOR map with kty: 2 but no x/y
            const incompleteKey = new Uint8Array([
                0xa1, // Map with 1 item
                0x01,
                0x02, // kty: 2 (EC2)
            ]);

            expect(() => parseCosePublicKey(incompleteKey)).toThrow(
                "COSE key missing x or y coordinates"
            );
        });
    });

    describe("extractPublicKeyFromAttestationObject", () => {
        it("should return null for empty data", () => {
            const result = extractPublicKeyFromAttestationObject(
                new ArrayBuffer(0)
            );
            expect(result).toBeNull();
        });

        it("should return null for invalid CBOR", () => {
            const invalidCbor = new Uint8Array([0xff, 0xff, 0xff]);
            const result = extractPublicKeyFromAttestationObject(
                invalidCbor.buffer
            );
            expect(result).toBeNull();
        });

        it("should extract public key from valid attestation object", () => {
            // Build a minimal valid attestation object
            // This is a CBOR map with:
            // - "fmt": "none"
            // - "attStmt": {}
            // - "authData": <authenticator data with public key>

            // First, build the authData
            const rpIdHash = new Uint8Array(32).fill(0x00);
            const flags = 0x41; // UP=1, AT=1 (attested credential data present)
            const signCount = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
            const aaguid = new Uint8Array(16).fill(0x00);
            const credIdLength = new Uint8Array([0x00, 0x10]); // 16 bytes
            const credId = new Uint8Array(16).fill(0xaa);

            // Build COSE key for P-256
            const xCoord = new Uint8Array(32);
            const yCoord = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
                xCoord[i] = i;
                yCoord[i] = 32 + i;
            }

            const coseKey = new Uint8Array([
                0xa5, // Map with 5 items
                0x01,
                0x02, // kty: 2 (EC2)
                0x03,
                0x26, // alg: -7 (ES256)
                0x20,
                0x01, // crv: 1 (P-256)
                0x21,
                0x58,
                0x20, // x: byte string of 32 bytes
                ...xCoord,
                0x22,
                0x58,
                0x20, // y: byte string of 32 bytes
                ...yCoord,
            ]);

            const authData = new Uint8Array([
                ...rpIdHash,
                flags,
                ...signCount,
                ...aaguid,
                ...credIdLength,
                ...credId,
                ...coseKey,
            ]);

            // Build attestation object CBOR
            // A3 = map with 3 items
            // 63 666d74 = "fmt" (text string of 3 chars)
            // 64 6e6f6e65 = "none" (text string of 4 chars)
            // 67 6174745374 6d74 = "attStmt" (text string of 7 chars)
            // A0 = empty map
            // 68 61757468 44617461 = "authData" (text string of 8 chars)
            // 58 <len> <authData> = byte string
            const attestationObject = new Uint8Array([
                0xa3, // Map with 3 items
                0x63,
                0x66,
                0x6d,
                0x74, // "fmt"
                0x64,
                0x6e,
                0x6f,
                0x6e,
                0x65, // "none"
                0x67,
                0x61,
                0x74,
                0x74,
                0x53,
                0x74,
                0x6d,
                0x74, // "attStmt"
                0xa0, // empty map
                0x68,
                0x61,
                0x75,
                0x74,
                0x68,
                0x44,
                0x61,
                0x74,
                0x61, // "authData"
                0x59,
                (authData.length >> 8) & 0xff,
                authData.length & 0xff, // byte string length (2 bytes)
                ...authData,
            ]);

            const result = extractPublicKeyFromAttestationObject(
                attestationObject.buffer
            );

            expect(result).not.toBeNull();
            const publicKeyBytes = new Uint8Array(result!);

            // Should be 91 bytes: SPKI prefix (26 bytes) + 0x04 + x (32 bytes) + y (32 bytes)
            // This matches what the native browser getPublicKey() returns
            expect(publicKeyBytes.length).toBe(91);

            // Verify SPKI structure prefix (first 26 bytes)
            const expectedPrefix = new Uint8Array([
                // SEQUENCE (total length 89 = 0x59)
                0x30, 0x59,
                // SEQUENCE (algorithm identifier, length 19 = 0x13)
                0x30, 0x13,
                // OBJECT IDENTIFIER ecPublicKey (1.2.840.10045.2.1)
                0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
                // OBJECT IDENTIFIER prime256v1/P-256 (1.2.840.10045.3.1.7)
                0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
                // BIT STRING (length 66 = 0x42, no unused bits = 0x00)
                0x03, 0x42, 0x00,
            ]);
            expect(publicKeyBytes.slice(0, 26)).toEqual(expectedPrefix);

            // Uncompressed point indicator at offset 26
            expect(publicKeyBytes[26]).toBe(0x04);

            // Check x coordinate (starts at offset 27)
            for (let i = 0; i < 32; i++) {
                expect(publicKeyBytes[27 + i]).toBe(i);
            }

            // Check y coordinate (starts at offset 59)
            for (let i = 0; i < 32; i++) {
                expect(publicKeyBytes[59 + i]).toBe(32 + i);
            }
        });

        it("should return null when AT flag is not set", () => {
            // Build authData without AT flag
            const rpIdHash = new Uint8Array(32).fill(0x00);
            const flags = 0x01; // Only UP flag, no AT
            const signCount = new Uint8Array([0x00, 0x00, 0x00, 0x00]);

            const authData = new Uint8Array([...rpIdHash, flags, ...signCount]);

            const attestationObject = new Uint8Array([
                0xa3, // Map with 3 items
                0x63,
                0x66,
                0x6d,
                0x74, // "fmt"
                0x64,
                0x6e,
                0x6f,
                0x6e,
                0x65, // "none"
                0x67,
                0x61,
                0x74,
                0x74,
                0x53,
                0x74,
                0x6d,
                0x74, // "attStmt"
                0xa0, // empty map
                0x68,
                0x61,
                0x75,
                0x74,
                0x68,
                0x44,
                0x61,
                0x74,
                0x61, // "authData"
                0x58,
                authData.length, // byte string length (1 byte, <256)
                ...authData,
            ]);

            const result = extractPublicKeyFromAttestationObject(
                attestationObject.buffer
            );

            expect(result).toBeNull();
        });
    });
});

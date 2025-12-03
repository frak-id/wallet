/**
 * COSE Public Key Parser
 *
 * This module parses COSE-encoded EC2 public keys from WebAuthn attestation data.
 * It's specifically designed for extracting P-256 (ES256) public keys from the
 * attestationObject when the getPublicKey() method is not available (e.g., on Android Tauri).
 *
 * The attestationObject is CBOR-encoded and contains:
 * - fmt: attestation format
 * - attStmt: attestation statement
 * - authData: authenticator data (which contains the COSE public key)
 *
 * The authData structure is:
 * - rpIdHash (32 bytes)
 * - flags (1 byte)
 * - signCount (4 bytes)
 * - attestedCredentialData (variable, only if AT flag is set):
 *   - AAGUID (16 bytes)
 *   - credentialIdLength (2 bytes, big-endian)
 *   - credentialId (credentialIdLength bytes)
 *   - credentialPublicKey (COSE-encoded, variable length)
 *
 * The COSE key structure for EC2 P-256 is a CBOR map with:
 * - 1 (kty): 2 (EC2)
 * - 3 (alg): -7 (ES256)
 * - -1 (crv): 1 (P-256)
 * - -2 (x): 32-byte x coordinate
 * - -3 (y): 32-byte y coordinate
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc8152
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/Authenticator_data
 */

/**
 * The result of parsing a COSE EC2 public key
 */
export type CosePublicKey = {
    x: Uint8Array;
    y: Uint8Array;
};

/**
 * CBOR major types
 */
const CBOR_MAJOR_TYPE = {
    UNSIGNED_INT: 0,
    NEGATIVE_INT: 1,
    BYTE_STRING: 2,
    TEXT_STRING: 3,
    ARRAY: 4,
    MAP: 5,
    TAG: 6,
    SIMPLE_OR_FLOAT: 7,
} as const;

/**
 * COSE key parameters for EC2 keys
 */
const COSE_KEY = {
    KTY: 1, // Key type
    ALG: 3, // Algorithm
    CRV: -1, // Curve (for EC2)
    X: -2, // X coordinate (for EC2)
    Y: -3, // Y coordinate (for EC2)
} as const;

/**
 * Simple CBOR decoder for WebAuthn attestation data
 * Only supports the subset of CBOR needed for parsing attestationObject
 */
class CborDecoder {
    private data: Uint8Array;
    private offset: number;

    constructor(data: Uint8Array) {
        this.data = data;
        this.offset = 0;
    }

    /**
     * Decode the next CBOR value
     */
    decode(): unknown {
        if (this.offset >= this.data.length) {
            throw new Error("CBOR: Unexpected end of data");
        }

        const initialByte = this.data[this.offset++];
        const majorType = initialByte >> 5;
        const additionalInfo = initialByte & 0x1f;

        switch (majorType) {
            case CBOR_MAJOR_TYPE.UNSIGNED_INT:
                return this.decodeUnsignedInt(additionalInfo);

            case CBOR_MAJOR_TYPE.NEGATIVE_INT:
                return -1 - Number(this.decodeUnsignedInt(additionalInfo));

            case CBOR_MAJOR_TYPE.BYTE_STRING:
                return this.decodeByteString(additionalInfo);

            case CBOR_MAJOR_TYPE.TEXT_STRING:
                return this.decodeTextString(additionalInfo);

            case CBOR_MAJOR_TYPE.ARRAY:
                return this.decodeArray(additionalInfo);

            case CBOR_MAJOR_TYPE.MAP:
                return this.decodeMap(additionalInfo);

            case CBOR_MAJOR_TYPE.TAG:
                // Skip tag and decode the tagged value
                this.decodeUnsignedInt(additionalInfo);
                return this.decode();

            case CBOR_MAJOR_TYPE.SIMPLE_OR_FLOAT:
                return this.decodeSimpleOrFloat(additionalInfo);

            default:
                throw new Error(`CBOR: Unknown major type ${majorType}`);
        }
    }

    private decodeUnsignedInt(additionalInfo: number): number | bigint {
        if (additionalInfo < 24) {
            return additionalInfo;
        }

        switch (additionalInfo) {
            case 24:
                return this.data[this.offset++];
            case 25:
                return this.readUint16();
            case 26:
                return this.readUint32();
            case 27:
                return this.readUint64();
            default:
                throw new Error(
                    `CBOR: Invalid additional info for int: ${additionalInfo}`
                );
        }
    }

    private decodeByteString(additionalInfo: number): Uint8Array {
        const length = Number(this.decodeUnsignedInt(additionalInfo));
        const result = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return result;
    }

    private decodeTextString(additionalInfo: number): string {
        const bytes = this.decodeByteString(additionalInfo);
        return new TextDecoder().decode(bytes);
    }

    private decodeArray(additionalInfo: number): unknown[] {
        const length = Number(this.decodeUnsignedInt(additionalInfo));
        const result: unknown[] = [];
        for (let i = 0; i < length; i++) {
            result.push(this.decode());
        }
        return result;
    }

    private decodeMap(additionalInfo: number): Map<unknown, unknown> {
        const length = Number(this.decodeUnsignedInt(additionalInfo));
        const result = new Map<unknown, unknown>();
        for (let i = 0; i < length; i++) {
            const key = this.decode();
            const value = this.decode();
            result.set(key, value);
        }
        return result;
    }

    private decodeSimpleOrFloat(additionalInfo: number): unknown {
        switch (additionalInfo) {
            case 20:
                return false;
            case 21:
                return true;
            case 22:
                return null;
            case 23:
                return undefined;
            case 25:
                // Half-precision float (not commonly used)
                this.offset += 2;
                return 0;
            case 26:
                // Single-precision float
                this.offset += 4;
                return 0;
            case 27:
                // Double-precision float
                this.offset += 8;
                return 0;
            default:
                if (additionalInfo < 20) {
                    return additionalInfo;
                }
                throw new Error(
                    `CBOR: Unknown simple value: ${additionalInfo}`
                );
        }
    }

    private readUint16(): number {
        const value =
            (this.data[this.offset] << 8) | this.data[this.offset + 1];
        this.offset += 2;
        return value;
    }

    private readUint32(): number {
        const value =
            (this.data[this.offset] << 24) |
            (this.data[this.offset + 1] << 16) |
            (this.data[this.offset + 2] << 8) |
            this.data[this.offset + 3];
        this.offset += 4;
        return value >>> 0; // Convert to unsigned
    }

    private readUint64(): bigint {
        const high = BigInt(this.readUint32());
        const low = BigInt(this.readUint32());
        return (high << 32n) | low;
    }
}

/**
 * Parse CBOR-encoded data
 */
function decodeCbor(data: Uint8Array): unknown {
    const decoder = new CborDecoder(data);
    return decoder.decode();
}

/**
 * Extract the public key from a COSE-encoded EC2 key structure
 *
 * @param coseKeyBytes - The CBOR-encoded COSE key
 * @returns The x and y coordinates of the public key
 */
export function parseCosePublicKey(coseKeyBytes: Uint8Array): CosePublicKey {
    const decoded = decodeCbor(coseKeyBytes);

    if (!(decoded instanceof Map)) {
        throw new Error("COSE key is not a CBOR map");
    }

    const coseKey = decoded as Map<number, unknown>;

    // Verify it's an EC2 key (kty = 2)
    const kty = coseKey.get(COSE_KEY.KTY);
    if (kty !== 2) {
        throw new Error(`COSE key is not EC2 (kty=${kty})`);
    }

    // Get x and y coordinates
    const x = coseKey.get(COSE_KEY.X);
    const y = coseKey.get(COSE_KEY.Y);

    if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
        throw new Error("COSE key missing x or y coordinates");
    }

    if (x.length !== 32 || y.length !== 32) {
        throw new Error(
            `COSE key has invalid coordinate lengths: x=${x.length}, y=${y.length}`
        );
    }

    return { x, y };
}

/**
 * Extract the public key from a WebAuthn attestationObject
 *
 * This parses the CBOR-encoded attestationObject to extract the authData,
 * then parses the authData to find the attestedCredentialData (if present),
 * and finally extracts the COSE-encoded public key.
 *
 * @param attestationObject - The raw attestationObject as ArrayBuffer
 * @returns The public key in DER SubjectPublicKeyInfo (SPKI) format (91 bytes), or null if not found
 */
export function extractPublicKeyFromAttestationObject(
    attestationObject: ArrayBuffer
): ArrayBuffer | null {
    try {
        const attestationData = new Uint8Array(attestationObject);
        const decoded = decodeCbor(attestationData);

        if (!(decoded instanceof Map)) {
            console.error("[COSE] Attestation object is not a CBOR map");
            return null;
        }

        const attestation = decoded as Map<string, unknown>;

        // Get authData from attestation object
        const authData = attestation.get("authData");
        if (!(authData instanceof Uint8Array)) {
            console.error("[COSE] authData not found or not a byte string");
            return null;
        }

        // Parse authData structure
        // rpIdHash (32) + flags (1) + signCount (4) = 37 bytes minimum
        if (authData.length < 37) {
            console.error("[COSE] authData too short:", authData.length);
            return null;
        }

        const flags = authData[32];

        // Check if AT (Attested Credential Data) flag is set (bit 6)
        const hasAttestedCredentialData = (flags & 0x40) !== 0;
        if (!hasAttestedCredentialData) {
            console.error("[COSE] No attested credential data in authData");
            return null;
        }

        // Parse attestedCredentialData starting at offset 37
        // AAGUID (16) + credentialIdLength (2) + credentialId (variable) + credentialPublicKey (variable)
        let offset = 37;

        // Skip AAGUID (16 bytes)
        offset += 16;

        // Read credentialIdLength (2 bytes, big-endian)
        const credentialIdLength =
            (authData[offset] << 8) | authData[offset + 1];
        offset += 2;

        // Skip credentialId
        offset += credentialIdLength;

        // The rest is the COSE-encoded public key
        const coseKeyBytes = authData.slice(offset);

        // Parse the COSE key to extract x and y coordinates
        const { x, y } = parseCosePublicKey(coseKeyBytes);

        // Return in DER SubjectPublicKeyInfo (SPKI) format, which is what the
        // native browser's getPublicKey() method returns.
        //
        // SPKI structure for P-256:
        // SEQUENCE {
        //   SEQUENCE {
        //     OBJECT IDENTIFIER 1.2.840.10045.2.1 (ecPublicKey)
        //     OBJECT IDENTIFIER 1.2.840.10045.3.1.7 (prime256v1/P-256)
        //   }
        //   BIT STRING (uncompressed point: 0x04 || x || y)
        // }
        //
        // The fixed prefix for P-256 SPKI is 26 bytes, followed by 65 bytes of point data
        const SPKI_P256_PREFIX = new Uint8Array([
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

        // Build SPKI: prefix (26 bytes) + 0x04 + x (32 bytes) + y (32 bytes) = 91 bytes total
        const spkiKey = new Uint8Array(91);
        spkiKey.set(SPKI_P256_PREFIX, 0);
        spkiKey[26] = 0x04; // Uncompressed point indicator
        spkiKey.set(x, 27);
        spkiKey.set(y, 59);

        return spkiKey.buffer;
    } catch (error) {
        console.error(
            "[COSE] Failed to extract public key from attestation object:",
            error
        );
        return null;
    }
}

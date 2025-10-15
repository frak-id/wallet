import { decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";
import { toHex } from "viem";

/**
 * Decode the public key from the attestation object
 * @param credentialPubKey
 */
export function decodePublicKey({
    credentialPubKey,
}: { credentialPubKey: Uint8Array }) {
    const publicKey = decodeCredentialPublicKey(
        credentialPubKey as Uint8Array<ArrayBuffer>
    ) as unknown as {
        get(key: DecodedPubKeyIndexes.kty): number | undefined;
        get(key: DecodedPubKeyIndexes.alg): number | undefined;
        get(key: DecodedPubKeyIndexes.crv): DecodedPubKeyCrv | undefined;
        get(key: DecodedPubKeyIndexes.x): Uint8Array | undefined;
        get(key: DecodedPubKeyIndexes.y): Uint8Array | undefined;
    };

    const x = toHex(
        publicKey.get(DecodedPubKeyIndexes.x) ?? Uint8Array.from([])
    );
    const y = toHex(
        publicKey.get(DecodedPubKeyIndexes.y) ?? Uint8Array.from([])
    );

    return { x, y };
}

/**
 * The indexes zhere zhen can find each value in the decoded public key (matching the COSE curve)
 */
enum DecodedPubKeyIndexes {
    kty = 1,
    alg = 3,
    crv = -1,
    x = -2,
    y = -3,
    n = -1,
    e = -2,
}

/**
 * The different type of curves we knoz about the public key
 */
enum DecodedPubKeyCrv {
    P256 = 1,
    P384 = 2,
    P521 = 3,
    ED25519 = 6,
    SECP256K1 = 8,
}

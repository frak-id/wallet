import { bufferToBase64URLString } from "@simplewebauthn/browser";
import { random } from "radash";
import {
    type Address,
    concat,
    concatBytes,
    type Hex,
    keccak256,
    stringToBytes,
    toBytes,
} from "viem";

/**
 * Convert a pass to a cryptographical key
 * @param pass
 * @param salt
 */
export async function passToKey({
    pass,
    salt,
}: {
    pass: string;
    salt: Uint8Array;
}) {
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        stringToBytes(pass),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    // Create the derivated private key
    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 300_000,
            hash: "SHA-512",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Function used to generate an encrypted burner wallet string
 * @param privateKey
 * @param initialAddress
 */
export async function encryptPrivateKey({
    privateKey,
    initialAddress,
    pass,
}: {
    privateKey: Hex;
    initialAddress: Address;
    pass: string;
}) {
    if (typeof window === "undefined") {
        throw new Error("This function should only be used in the browser");
    }

    // Create our encryption parameters
    const ivLength = random(16, 64);
    const iv = window.crypto.getRandomValues(new Uint8Array(ivLength));

    // Append wallet address to the salt
    const saltLength = random(16, 128);
    const randomSalt = window.crypto.getRandomValues(
        new Uint8Array(saltLength)
    );
    const salt = concatBytes([randomSalt, toBytes(keccak256(initialAddress))]);

    // Generate the encryption key
    const key = await passToKey({ pass, salt });

    // Encrypt the private key
    const encyptedPrivKey = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        stringToBytes(privateKey)
    );

    // Concat all the data and return them
    return bufferToBase64URLString(
        concat([
            toBytes(ivLength),
            iv,
            toBytes(saltLength),
            salt,
            new Uint8Array(encyptedPrivKey),
        ]).buffer as ArrayBuffer
    );
}

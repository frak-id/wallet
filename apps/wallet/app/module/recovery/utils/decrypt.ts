import { base64URLStringToBuffer } from "@frak-labs/wallet-shared/common/utils/base64url";
import { bytesToString, type Hex } from "viem";
import { passToKey } from "@/module/recovery-setup/utils/encrypt";

/**
 * Decrypts the guardian private key using the password
 * @param pass
 * @param guardianPrivateKeyEncrypted
 */
export async function decryptPrivateKey({
    pass,
    guardianPrivateKeyEncrypted,
}: {
    pass: string;
    guardianPrivateKeyEncrypted: string;
}) {
    if (typeof window === "undefined") {
        throw new Error("This function should only be used in the browser");
    }

    // Extract all the datas from the encrypted file
    const sigData = new Uint8Array(
        base64URLStringToBuffer(guardianPrivateKeyEncrypted)
    );

    // Extract a some stuff from the encryption data
    const ivLength = sigData[0];
    const iv = sigData.slice(1, ivLength + 1);
    const saltLength = sigData[ivLength + 1] + 32;
    const salt = sigData.slice(ivLength + 2, ivLength + 2 + saltLength);
    const encyptedPrivKeyExtracted = sigData.slice(ivLength + 2 + saltLength);

    // Then try to decrypt it
    const key = await passToKey({ pass, salt });
    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        encyptedPrivKeyExtracted
    );

    return bytesToString(new Uint8Array(decrypted)) as Hex;
}

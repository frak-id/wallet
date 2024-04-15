import type { RecoveryFileContent } from "@/types/Recovery";
import { base64URLStringToBuffer } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { bytesToString, stringToBytes } from "viem";

/**
 * Generate the recovery file
 */
export function useParseRecoveryFile() {
    const { mutateAsync } = useMutation({
        mutationKey: ["recovery", "parse-file"],
        gcTime: 0,
        mutationFn: async ({
            file,
            pass,
        }: { file: RecoveryFileContent; pass: string }) => {
            // Extract all the datas from the encrypted file
            const sigData = new Uint8Array(
                base64URLStringToBuffer(file.guardianPrivateKeyEncrypted)
            );

            // Extract a some stuff from the encryption data
            const ivLength = sigData[0];
            const iv = sigData.slice(1, ivLength + 1);
            const saltLength = sigData[ivLength + 1] + 32;
            const salt = sigData.slice(ivLength + 2, ivLength + 2 + saltLength);
            const encyptedPrivKeyExtracted = sigData.slice(
                ivLength + 2 + saltLength
            );

            console.log("Result extracted", {
                ivLengthExtracted: ivLength,
                ivExtracted: iv,
                saltLengthExtracted: saltLength,
                saltExtracted: salt,
                encyptedPrivKeyExtracted,
            });

            // Then try to decrypt it
            const rawKey = await window.crypto.subtle.importKey(
                "raw",
                stringToBytes(pass),
                { name: "PBKDF2" },
                false,
                ["deriveBits", "deriveKey"]
            );
            const derivativeKey = await window.crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 300_000,
                    hash: "SHA-512",
                },
                rawKey,
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
            );
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv,
                },
                derivativeKey,
                encyptedPrivKeyExtracted
            );

            console.log("Decrypted", {
                decrypted: bytesToString(new Uint8Array(decrypted)),
            });
            return bytesToString(new Uint8Array(decrypted));
        },
    });

    return mutateAsync;
}

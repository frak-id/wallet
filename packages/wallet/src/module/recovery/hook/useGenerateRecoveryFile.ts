import type {
    GeneratedRecoveryData,
    RecoveryFileContent,
} from "@/types/Recovery";
import { bufferToBase64URLString } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { random } from "radash";
import { concat, concatBytes, keccak256, stringToBytes, toBytes } from "viem";

/**
 * Generate the recovery file
 */
export function useGenerateRecoveryFile() {
    const { mutateAsync } = useMutation({
        mutationKey: ["recovery", "generate-file"],
        gcTime: 0,
        mutationFn: async ({
            option,
            pass,
        }: {
            option: GeneratedRecoveryData;
            pass: string;
        }): Promise<RecoveryFileContent> => {
            // Create our encryption parameters
            const ivLength = random(16, 64);
            const iv = window.crypto.getRandomValues(new Uint8Array(ivLength));

            // Append wallet address to the salt
            const saltLength = random(16, 128);
            const randomSalt = window.crypto.getRandomValues(
                new Uint8Array(saltLength)
            );
            const salt = concatBytes([
                randomSalt,
                toBytes(keccak256(option.wallet.address)),
            ]);
            console.log("Salt", {
                salt,
                saltLength,
                randomSalt,
                walletAddress: option.wallet.address,
            });

            // Generate the base key
            console.log("Generating base key");
            const baseKey = await window.crypto.subtle.importKey(
                "raw",
                stringToBytes(pass),
                { name: "PBKDF2" },
                false,
                ["deriveBits", "deriveKey"]
            );

            // Create the derivated private key
            console.log("Derivating key");
            const derivatedKey = await window.crypto.subtle.deriveKey(
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

            // Encrypt the private key
            console.log("Encrypting private key");
            const encyptedPrivKey = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv,
                },
                derivatedKey,
                stringToBytes(option.burner.privateKey)
            );

            // Concat all the data
            const allInOneEncryption = bufferToBase64URLString(
                concat([
                    toBytes(ivLength),
                    iv,
                    toBytes(saltLength),
                    salt,
                    new Uint8Array(encyptedPrivKey),
                ])
            );

            // Return the file content
            return {
                initialWallet: option.wallet,
                guardianAddress: option.burner.address,
                guardianPrivateKeyEncrypted: allInOneEncryption,
            };
        },
    });

    return mutateAsync;
}

import { generateRecoveryData } from "@/context/recover/action/generate";
import { encryptPrivateKey } from "@/module/recovery/utils/encrypt";
import type { RecoveryFileContent } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { useMutation } from "@tanstack/react-query";
import { type Hex, isAddressEqual } from "viem";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";

/**
 * Generate the recovery file
 */
export function useGenerateRecoveryOptions() {
    const { mutateAsync } = useMutation({
        mutationKey: ["recovery", "generate-file"],
        gcTime: 0,
        mutationFn: async ({
            wallet,
            pass,
        }: {
            wallet: WebAuthNWallet;
            pass: string;
        }): Promise<{ setupTxData: Hex; file: RecoveryFileContent }> => {
            // Create the burner wallet
            const burnerWallet = generatePrivateKey();
            const burnerAddress = privateKeyToAddress(burnerWallet);

            // Get the recovery options
            const options = await generateRecoveryData({
                wallet,
                guardianAddress: burnerAddress,
            });

            // Ensure the burner address is the same (prevent potential caching issue)
            if (!isAddressEqual(burnerAddress, options.guardianAddress)) {
                throw new Error("Burner address mismatch");
            }

            // Generate the secure string
            const guardianPrivateKeyEncrypted = await encryptPrivateKey({
                privateKey: burnerWallet,
                initialAddress: wallet.address,
                pass,
            });

            // Return the file content
            return {
                setupTxData: options.setupTxData,
                file: {
                    initialWallet: wallet,
                    guardianAddress: burnerAddress,
                    guardianPrivateKeyEncrypted,
                },
            };
        },
    });

    return mutateAsync;
}

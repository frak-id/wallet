import type {
    RecoveryFileContent,
    WebAuthNWallet,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { type Hex, isAddressEqual } from "viem";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { generateRecoveryData } from "@/module/recovery/action/generate";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";
import { encryptPrivateKey } from "@/module/recovery-setup/utils/encrypt";

/**
 * Generate the recovery file
 */
export function useGenerateRecoveryOptions() {
    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        mutationKey: recoverySetupKey.generateFile,
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

            // Return the file product
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

    return {
        ...mutationStuff,
        generateRecoveryOptionsAsync: mutateAsync,
        generateRecoveryOptions: mutate,
    };
}

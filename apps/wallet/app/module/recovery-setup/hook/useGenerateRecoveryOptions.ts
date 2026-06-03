import type { WebAuthNWallet } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { type Hex, isAddressEqual } from "viem";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { generateRecoveryData } from "@/module/recovery/action/generate";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";
import { encodeRecoveryBlob } from "@/module/recovery-setup/utils/recoveryBlob";

/**
 * Generate the on-chain recovery setup tx and the encrypted backup blob.
 *
 * Mints a burner (the ECDSA guardian) and seals `{ smartWalletAddress, burnerKey }`
 * with the user's password into the blob. The burner key only lives inside this
 * mutation — it leaves solely as ciphertext.
 */
export function useGenerateRecoveryOptions() {
    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        mutationKey: recoverySetupKey.generateOptions,
        gcTime: 0,
        mutationFn: async ({
            wallet,
            password,
            validAfter,
            validUntil,
        }: {
            wallet: WebAuthNWallet;
            password: string;
            validAfter: number;
            validUntil: number;
        }): Promise<{ setupTxData: Hex; blob: string }> => {
            const burnerPrivateKey = generatePrivateKey();
            const burnerAddress = privateKeyToAddress(burnerPrivateKey);

            const options = await generateRecoveryData({
                guardianAddress: burnerAddress,
                validAfter,
                validUntil,
            });

            if (!isAddressEqual(burnerAddress, options.guardianAddress)) {
                throw new Error("Burner address mismatch");
            }

            const blob = await encodeRecoveryBlob({
                smartWalletAddress: wallet.address,
                burnerPrivateKey,
                password,
            });

            return { setupTxData: options.setupTxData, blob };
        },
    });

    return {
        ...mutationStuff,
        generateRecoveryOptionsAsync: mutateAsync,
        generateRecoveryOptions: mutate,
    };
}

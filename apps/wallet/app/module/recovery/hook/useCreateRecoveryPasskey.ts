import { getRegisterOptions, getTauriCreateFn } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { WebAuthnP256 } from "ox";
import { type Hex, toHex } from "viem";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";

/**
 * A freshly-created recovery passkey, kept client-side. The `raw` registration
 * response is forwarded to the backend claim only AFTER the passkey has been
 * added on-chain — it is never registered through `/auth/register` (which would
 * bind it to its own derived wallet instead of the recovered one).
 */
export type RecoveryCredential = {
    id: string;
    publicKey: { x: Hex; y: Hex; prefix: number };
    /** base64-encoded WebAuthn registration response JSON. */
    raw: string;
};

/**
 * Create a new WebAuthn authenticator for the recovery flow. Pure device
 * ceremony — no backend call here, the credential is registered against the
 * recovered wallet later via the claim endpoint.
 */
export function useCreateRecoveryPasskey() {
    const { mutateAsync, mutate, ...mutationStuff } = useMutation({
        mutationKey: recoveryKey.createRecoveryPasskey,
        gcTime: 0,
        mutationFn: async (): Promise<RecoveryCredential> => {
            // Get the registration options and start the registration
            // Only pass createFn if defined (Android), omit for iOS/web to use browser default
            const tauriCreateFn = getTauriCreateFn();
            const { id, publicKey, raw } = await WebAuthnP256.createCredential({
                ...getRegisterOptions(),
                ...(tauriCreateFn && { createFn: tauriCreateFn }),
            });

            return {
                id,
                publicKey: {
                    x: toHex(publicKey.x),
                    y: toHex(publicKey.y),
                    prefix: publicKey.prefix,
                },
                raw: btoa(JSON.stringify(raw)),
            };
        },
    });

    return {
        ...mutationStuff,
        createRecoveryPasskeyAsync: mutateAsync,
        createRecoveryPasskey: mutate,
    };
}

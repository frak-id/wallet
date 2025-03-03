import { jotaiStore } from "@frak-labs/shared/module/atoms/store";
import { trackEvent } from "@frak-labs/shared/module/utils/trackEvent";
import { useMutation } from "@tanstack/react-query";
import { type Address, type Hex, stringToHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { authenticatedBackendApi } from "../../common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "../../common/atoms/session";

export function useDemoLogin() {
    return useMutation({
        mutationKey: ["demo-registration"],
        async mutationFn({ pkey, ssoId }: { pkey: Hex; ssoId?: Hex }) {
            const account = privateKeyToAccount(pkey);

            // Generate the msg to sign with the challenge
            const challenge = generatePrivateKey();
            const message = `I want to connect to Frak and I accept the CGU.\n Verification code:${challenge}`;

            // Sign the login message
            const signature = await account.signMessage({
                message: { raw: stringToHex(message) },
            });

            // Launch the backend authentication process
            const { data, error } =
                await authenticatedBackendApi.auth.wallet.ecdsaLogin.post({
                    expectedChallenge: challenge,
                    signature,
                    wallet: account.address as Address,
                    ssoId,
                    demoPkey: pkey,
                });
            if (error) {
                throw error;
            }

            // Extract a few data
            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token };

            // Store the session
            jotaiStore.set(sessionAtom, session);
            jotaiStore.set(sdkSessionAtom, sdkJwt);

            // Track the event
            trackEvent("cta-demo-login");

            // Store the session
            jotaiStore.set(sessionAtom, session);
            jotaiStore.set(sdkSessionAtom, sdkJwt);
            return session;
        },
    });
}

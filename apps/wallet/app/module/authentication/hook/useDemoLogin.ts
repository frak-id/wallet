import { authKey } from "@/module/authentication/queryKeys/auth";
import { jotaiStore } from "@frak-labs/shared/module/atoms/store";
import { useMutation } from "@tanstack/react-query";
import { type Address, type Hex, stringToHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Session } from "../../../types/Session";
import { trackAuthCompleted, trackAuthInitiated } from "../../common/analytics";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "../../common/atoms/session";

export function useDemoLogin() {
    return useMutation({
        mutationKey: authKey.demo.login,
        async mutationFn({ pkey, ssoId }: { pkey: Hex; ssoId?: Hex }) {
            // Identify the user and track the event
            await trackAuthInitiated("demo", {
                ssoId,
            });

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
                await authenticatedWalletApi.auth.ecdsaLogin.post({
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
            const session = { ...authentication, token } as Session;

            // Store the session
            jotaiStore.set(sessionAtom, session);
            jotaiStore.set(sdkSessionAtom, sdkJwt);

            // Store the session
            jotaiStore.set(sessionAtom, session);
            jotaiStore.set(sdkSessionAtom, sdkJwt);

            // Identify the user and track the event
            await trackAuthCompleted("demo", session, {
                ssoId,
            });

            return session;
        },
    });
}

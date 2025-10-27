import type { Session } from "@frak-labs/wallet-shared";
import {
    authenticatedWalletApi,
    authKey,
    sessionStore,
    trackAuthCompleted,
    trackAuthInitiated,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { type Address, type Hex, stringToHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export function useDemoLogin() {
    return useMutation({
        mutationKey: authKey.demo.login,
        async mutationFn({ pkey }: { pkey: Hex }) {
            // Identify the user and track the event
            const events = [trackAuthInitiated("demo")];

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
                    demoPkey: pkey,
                });
            if (error) {
                throw error;
            }

            // Extract a few data
            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token } as Session;

            // Store the session
            sessionStore.getState().setSession(session);
            sessionStore.getState().setSdkSession(sdkJwt);

            // Identify the user and track the event
            events.push(trackAuthCompleted("demo", session));
            await Promise.allSettled(events);

            return session;
        },
    });
}

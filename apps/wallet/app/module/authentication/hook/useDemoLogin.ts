import type { Flow, Session } from "@frak-labs/wallet-shared";
import {
    authenticatedWalletApi,
    authenticationStore,
    authKey,
    extractAuthError,
    identifyAuthenticatedUser,
    sessionStore,
    startFlow,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { type Address, type Hex, stringToHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

type DemoLoginArgs = {
    pkey: Hex;
    merchantId?: string;
};

type DemoContext = { flow: Flow };

/**
 * Demo-login TanStack mutation with scoped `auth_demo` flow.
 *
 * Like `useLogin`, abandonment is not instrumented at the hook layer — the
 * mutation outlives the component. If needed, wire `flow.end("abandoned")`
 * at the consuming route's unmount cleanup.
 */
export function useDemoLogin() {
    return useMutation<Session, Error, DemoLoginArgs, DemoContext>({
        mutationKey: authKey.demo.login,
        mutationFn: async ({ pkey, merchantId }) => {
            const account = privateKeyToAccount(pkey);

            // Generate the msg to sign with the challenge
            const challenge = generatePrivateKey();
            const message = `I want to connect to Frak and I accept the CGU.\n Verification code:${challenge}`;

            const signature = await account.signMessage({
                message: { raw: stringToHex(message) },
            });

            const { data, error } =
                await authenticatedWalletApi.auth.ecdsaLogin.post({
                    expectedChallenge: challenge,
                    signature,
                    wallet: account.address as Address,
                    demoPkey: pkey,
                    merchantId: merchantId || undefined,
                });
            if (error) {
                throw error;
            }

            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token } as Session;

            authenticationStore.getState().setLastAuthenticationAt(Date.now());
            sessionStore.getState().setSession(session);
            sessionStore.getState().setSdkSession(sdkJwt);

            return session;
        },
        onMutate: () => {
            const flow = startFlow("auth_demo");
            return { flow };
        },
        onSuccess: (session, _vars, ctx) => {
            identifyAuthenticatedUser(session);
            ctx?.flow.end("succeeded");
        },
        onError: (err, _vars, ctx) => {
            const { reason, error_type } = extractAuthError(err);
            ctx?.flow.end("failed", {
                error_type,
                error_message: reason,
            });
        },
    });
}

import type { Session } from "@frak-labs/wallet-shared";
import {
    authenticationStore,
    sessionStore,
    ssoKey,
} from "@frak-labs/wallet-shared";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useDemoLogin } from "@/module/authentication/hook/useDemoLogin";

export function useLoginDemo(options?: UseMutationOptions<Session>) {
    const { mutateAsync: demoLogin } = useDemoLogin();
    /**
     * Mutation used to launch the login demo process
     */
    const {
        isPending: isLoginInProgress,
        isSuccess,
        isError,
        error,
        mutateAsync,
    } = useMutation({
        ...options,
        mutationKey: ssoKey.demo.login,
        async mutationFn() {
            // Retrieve the pkey
            const pkey = sessionStore.getState().demoPrivateKey;
            if (!pkey) {
                throw new Error("No private key found");
            }

            // Launch the login process
            return demoLogin({
                pkey,
                merchantId:
                    authenticationStore.getState().ssoContext?.merchantId,
            });
        },
    });

    return {
        isLoginInProgress,
        isSuccess,
        isError,
        error,
        login: mutateAsync,
    };
}

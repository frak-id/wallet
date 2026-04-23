import type { Flow, Session } from "@frak-labs/wallet-shared";
import {
    addLastAuthentication,
    authenticatedWalletApi,
    authKey,
    extractAuthError,
    getRegisterOptions,
    getTauriCreateFn,
    identifyAuthenticatedUser,
    recoveryHintStorage,
    sessionStore,
    startFlow,
} from "@frak-labs/wallet-shared";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { WebAuthnP256 } from "ox";
import { toHex } from "viem";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";

type UseRegisterArgs = {
    merchantId?: string;
    // biome-ignore lint/suspicious/noConfusingVoidType: required for optional mutation arguments
} | void;

type RegisterContext = { flow: Flow };

export function useRegister(
    options?: UseMutationOptions<Session, Error, UseRegisterArgs>
) {
    const { data: previousAuthenticators } = usePreviousAuthenticators();

    const {
        isPending: isRegisterInProgress,
        isSuccess,
        isError,
        error,
        mutateAsync: register,
    } = useMutation<Session, Error, UseRegisterArgs, RegisterContext>({
        ...options,
        mutationKey: authKey.register,
        mutationFn: async (args?: UseRegisterArgs) => {
            // Only pass createFn if defined (Android), omit for iOS/web to use browser default
            const tauriCreateFn = getTauriCreateFn();
            const { id, publicKey, raw } = await WebAuthnP256.createCredential({
                ...getRegisterOptions(),
                excludeCredentialIds: previousAuthenticators?.map(
                    (cred) => cred.authenticatorId
                ),
                ...(tauriCreateFn && { createFn: tauriCreateFn }),
            });

            const encodedResponse = btoa(JSON.stringify(raw));
            const { data, error } =
                await authenticatedWalletApi.auth.register.post({
                    id,
                    userAgent: navigator.userAgent,
                    publicKey: {
                        x: toHex(publicKey.x),
                        y: toHex(publicKey.y),
                        prefix: publicKey.prefix,
                    },
                    raw: encodedResponse,
                    merchantId: args?.merchantId || undefined,
                });
            if (error) {
                throw error;
            }

            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token } as Session;

            await addLastAuthentication(session);

            // Persist a tiny uninstall-resilient hint so the next fresh
            // install can resume from the login flow. No-op outside Tauri.
            await recoveryHintStorage.set({
                lastAuthenticatorId: session.authenticatorId,
                lastWallet: session.address,
                lastLoginAt: Date.now(),
            });

            sessionStore.getState().setSession(session);
            sessionStore.getState().setSdkSession(sdkJwt);

            return session;
        },
        onMutate: (vars, mutationCtx) => {
            const flow = startFlow("auth_register");
            options?.onMutate?.(vars, mutationCtx);
            return { flow };
        },
        onSuccess: (session, vars, ctx, mutationCtx) => {
            identifyAuthenticatedUser(session);
            ctx?.flow.end("succeeded");
            options?.onSuccess?.(session, vars, ctx, mutationCtx);
        },
        onError: (err, vars, ctx, mutationCtx) => {
            const { reason, error_type } = extractAuthError(err);
            ctx?.flow.end("failed", {
                error_type,
                error_message: reason,
            });
            options?.onError?.(err, vars, ctx, mutationCtx);
        },
    });

    return {
        isRegisterInProgress,
        isSuccess,
        isError,
        error,
        register,
    };
}

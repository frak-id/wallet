import { WebAuthN } from "@frak-labs/app-essentials";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { WebAuthnP256 } from "ox";
import { generatePrivateKey } from "viem/accounts";
import {
    extractAuthError,
    type Flow,
    identifyAuthenticatedUser,
    startFlow,
} from "../../common/analytics";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import type { PreviousAuthenticatorModel } from "../../common/storage/PreviousAuthenticatorModel";
import { recoveryHintStorage } from "../../common/storage/recoveryHint";
import {
    addLastAuthentication,
    authenticationStore,
} from "../../stores/authenticationStore";
import { sessionStore } from "../../stores/sessionStore";
import type { Session } from "../../types/Session";
import { authKey } from "../queryKeys/auth";
import { getTauriGetFn } from "../webauthn/tauriBridge";

type UseLoginArgs = {
    lastAuthentication?: PreviousAuthenticatorModel;
    merchantId?: string;
    // biome-ignore lint/suspicious/noConfusingVoidType: required for optional mutation arguments
} | void;

type LoginContext = {
    flow: Flow;
    method: "global" | "specific";
};

/**
 * Auth-login TanStack mutation with scoped `auth_login` flow.
 *
 * The flow emits `_started` in `onMutate` and terminates in `onSuccess`/
 * `onError`. Abandonment (user closing the dialog mid-auth) is **not**
 * instrumented at this layer — the mutation outlives the component, and
 * we'd need the consuming route to own the cleanup. If a dedicated auth
 * abandonment metric becomes necessary, wire `flow.end("abandoned")` at
 * the component unmount site that holds the `ctx.flow` reference.
 */
export function useLogin(
    options?: UseMutationOptions<Session, Error, UseLoginArgs>
) {
    const {
        isPending: isLoading,
        isSuccess,
        isError,
        error,
        mutateAsync: login,
    } = useMutation<Session, Error, UseLoginArgs, LoginContext>({
        ...options,
        mutationKey: authKey.login,
        mutationFn: async (args?: UseLoginArgs) => {
            // Only pass getFn if defined (Android), omit for iOS/web to use browser default
            const challenge = generatePrivateKey();
            const tauriGetFn = getTauriGetFn();
            const { metadata, signature, raw } = await WebAuthnP256.sign({
                credentialId: args?.lastAuthentication?.authenticatorId,
                rpId: WebAuthN.rpId,
                userVerification: "required",
                challenge,
                ...(tauriGetFn && { getFn: tauriGetFn }),
            });
            const credentialId = raw.id;

            const authenticationResponse = {
                id: credentialId,
                response: {
                    metadata,
                    signature,
                },
            };

            const encodedResponse = btoa(
                JSON.stringify(authenticationResponse)
            );
            const { data, error } =
                await authenticatedWalletApi.auth.login.post({
                    expectedChallenge: challenge,
                    authenticatorResponse: encodedResponse,
                    merchantId: args?.merchantId || undefined,
                });
            if (error) {
                throw error;
            }

            authenticationStore.getState().setLastWebAuthNAction({
                wallet: data.address,
                signature: authenticationResponse,
                challenge: challenge,
            });

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
            const method = vars?.lastAuthentication ? "specific" : "global";
            const flow = startFlow("auth_login", { method });
            options?.onMutate?.(vars, mutationCtx);
            return { flow, method };
        },
        onSuccess: (session, vars, ctx, mutationCtx) => {
            identifyAuthenticatedUser(session);
            ctx?.flow.end("succeeded", { method: ctx?.method });
            options?.onSuccess?.(session, vars, ctx, mutationCtx);
        },
        onError: (err, vars, ctx, mutationCtx) => {
            const { reason, error_type } = extractAuthError(err);
            ctx?.flow.end("failed", {
                method: ctx?.method,
                error_type,
                error_message: reason,
            });
            options?.onError?.(err, vars, ctx, mutationCtx);
        },
    });

    return {
        isLoading,
        isSuccess,
        isError,
        error,
        login,
    };
}

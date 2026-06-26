import { WebAuthN } from "@frak-labs/app-essentials";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { WebAuthnP256 } from "ox";
import { generatePrivateKey } from "viem/accounts";
import {
    extractAuthError,
    type Flow,
    identifyAuthenticatedUser,
    recordError,
    startFlow,
} from "../../common/analytics";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import type { PreviousAuthenticatorModel } from "../../common/storage/PreviousAuthenticatorModel";
import { recoveryHintStorage } from "../../common/storage/recoveryHint";
import { addLastAuthentication } from "../../stores/authenticationStore";
import { detachedPairingSessionStore } from "../../stores/detachedPairingSessionStore";
import { sessionStore } from "../../stores/sessionStore";
import type { Session } from "../../types/Session";
import { authKey } from "../queryKeys/auth";
import {
    isReportableWebauthnError,
    webauthnErrorContext,
} from "../webauthn/errors";
import { getTauriGetFn } from "../webauthn/tauriBridge";

type UseLoginArgs = {
    lastAuthentication?: PreviousAuthenticatorModel;
    /**
     * Explicit allow-list passed to WebAuthn's `allowCredentials`. Used by
     * email-scoped login paths where the backend resolves an email to every
     * credential currently bound to the wallet (post-merge a single wallet
     * routinely accepts multiple passkeys). When provided, takes precedence
     * over `lastAuthentication.authenticatorId`.
     */
    allowedCredentialIds?: string[];
    merchantId?: string;
    /**
     * When set, the freshly minted session is written to the tab-scoped
     * `detachedPairingSessionStore` under this pairing id instead of the
     * live `sessionStore`. The user's existing app session stays in place.
     *
     * Used by the cross-device merge target flow: the scanner authenticates
     * with the hint credential to satisfy the backend's authenticator match
     * without losing their normal wallet identity. Skips the "claim this
     * identity" side effects (`addLastAuthentication`, `recoveryHintStorage`,
     * `identifyAuthenticatedUser`) — those would mislabel the user as the
     * detached credential's owner across analytics + recovery surfaces.
     */
    detachedPairingId?: string;
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
            // TODO(prefer-immediate): on Tauri we can't tell "user cancelled" from
            // "no passkey on this device" — both collapse onto NotAllowedError →
            // `cancelled`. The native `preferImmediatelyAvailableCredentials` flag
            // fixes this (Android: GetCredentialRequest →NoCredentialException; iOS:
            // performRequests(.preferImmediatelyAvailableCredentials) →.notInteractive
            // 1005). It isn't exposed via ox's getFn, so adopting it means threading
            // a flag through getTauriGetFn → the register/authenticate plugin commands,
            // then mapping the resulting signal to the `no-credential` kind.
            const tauriGetFn = getTauriGetFn();
            const allowedCredentialIds =
                args?.allowedCredentialIds ??
                args?.lastAuthentication?.authenticatorId;
            const { metadata, signature, raw } = await WebAuthnP256.sign({
                credentialId: allowedCredentialIds,
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

            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token } as Session;

            if (args?.detachedPairingId) {
                detachedPairingSessionStore.getState().setDetachedSession({
                    pairingId: args.detachedPairingId,
                    session,
                    sdkSession: sdkJwt,
                });
                return session;
            }

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
            const hasSpecificHint = Boolean(
                vars?.lastAuthentication ||
                    (vars?.allowedCredentialIds &&
                        vars.allowedCredentialIds.length > 0)
            );
            const method = hasSpecificHint ? "specific" : "global";
            const flow = startFlow("auth_login", { method });
            options?.onMutate?.(vars, mutationCtx);
            return { flow, method };
        },
        onSuccess: (session, vars, ctx, mutationCtx) => {
            // Skip the analytics identify call when the session is a
            // detached pairing-scoped credential — the user isn't actually
            // "becoming" this identity in the app, just authenticating to
            // sign cross-device merge messages.
            if (!vars?.detachedPairingId) {
                identifyAuthenticatedUser(session);
            }
            ctx?.flow.end("succeeded", { method: ctx?.method });
            options?.onSuccess?.(session, vars, ctx, mutationCtx);
        },
        onError: (err, vars, ctx, mutationCtx) => {
            const { reason, error_type } = extractAuthError(err);
            const webauthn = webauthnErrorContext(err);
            if (isReportableWebauthnError(err)) {
                recordError(err, {
                    source: "authentication",
                    context: { method: ctx?.method, ...webauthn },
                });
            }
            ctx?.flow.end("failed", {
                operation: "login",
                method: ctx?.method,
                error_type,
                error_message: reason,
                ...webauthn,
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

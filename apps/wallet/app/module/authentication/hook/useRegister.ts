import type {
    Flow,
    PendingRegistration,
    Session,
} from "@frak-labs/wallet-shared";
import {
    addLastAuthentication,
    authenticatedWalletApi,
    authenticationStore,
    authKey,
    extractAuthError,
    getRegisterOptions,
    getTauriCreateFn,
    identifyAuthenticatedUser,
    recordError,
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
    email?: string;
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
        retry: (failureCount, err) =>
            failureCount < 3 && isTransientHttpError(err),
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
        ...options,
        mutationKey: authKey.register,
        mutationFn: async (args?: UseRegisterArgs) => {
            const email = asString(args?.email);
            const merchantId = asString(args?.merchantId);

            // Reuse the persisted credential if a previous attempt got past
            // the WebAuthn ceremony — keeps biometrics from prompting twice
            // after a backend submit failure.
            const pending = await getOrCreatePendingRegistration({
                email,
                merchantId,
                excludeCredentialIds: previousAuthenticators?.map(
                    (cred) => cred.authenticatorId
                ),
            });

            const { data, error: apiError } =
                await authenticatedWalletApi.auth.register.post({
                    id: pending.credentialId,
                    userAgent: pending.userAgent,
                    publicKey: pending.publicKey,
                    raw: pending.rawEncoded,
                    merchantId: merchantId ?? pending.merchantId,
                    email: email ?? pending.email,
                });
            if (apiError) {
                if (isPermanentHttpError(apiError)) {
                    // 4xx will never succeed on retry — drop the pending so
                    // the user can start a fresh ceremony rather than
                    // replaying the broken submit.
                    authenticationStore.getState().setPendingRegistration(null);
                }
                throw apiError;
            }

            authenticationStore.getState().setPendingRegistration(null);

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
            recordError(err, {
                source: "registration",
                context: { merchant: vars?.merchantId },
            });
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

/**
 * Eden Treaty surfaces HTTP errors with a numeric `status`. WebAuthn
 * ceremony errors and network-level throws do not — so checking `.status`
 * is enough to keep biometric prompts out of the retry path.
 */
function getHttpStatus(err: unknown): number | undefined {
    if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        typeof (err as { status: unknown }).status === "number"
    ) {
        return (err as { status: number }).status;
    }
    return undefined;
}

function isTransientHttpError(err: unknown): boolean {
    const status = getHttpStatus(err);
    return status === 0 || (status !== undefined && status >= 500);
}

function isPermanentHttpError(err: unknown): boolean {
    const status = getHttpStatus(err);
    return status !== undefined && status >= 400 && status < 500;
}

const asString = (value: unknown): string | undefined =>
    typeof value === "string" && value.length > 0 ? value : undefined;

async function getOrCreatePendingRegistration(args: {
    email?: string;
    merchantId?: string;
    excludeCredentialIds?: string[];
}): Promise<PendingRegistration> {
    const existing = authenticationStore.getState().pendingRegistration;
    if (existing) return existing;

    const tauriCreateFn = getTauriCreateFn();
    const { id, publicKey, raw } = await WebAuthnP256.createCredential({
        ...getRegisterOptions(),
        excludeCredentialIds: args.excludeCredentialIds,
        ...(tauriCreateFn && { createFn: tauriCreateFn }),
    });

    const pending: PendingRegistration = {
        credentialId: id,
        publicKey: {
            x: toHex(publicKey.x),
            y: toHex(publicKey.y),
            prefix: publicKey.prefix,
        },
        rawEncoded: btoa(JSON.stringify(raw)),
        email: args.email,
        merchantId: args.merchantId,
        userAgent: navigator.userAgent,
        createdAt: Date.now(),
    };

    // Persist BEFORE the backend call so a failure there can be retried
    // without re-prompting biometrics.
    authenticationStore.getState().setPendingRegistration(pending);
    return pending;
}

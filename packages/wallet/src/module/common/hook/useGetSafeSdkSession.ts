import { authenticatedBackendApi } from "@/context/common/backendClient";
import {
    getSafeSdkSession,
    getSafeSession,
} from "@/module/listener/utils/localStorage";
import { jotaiStore } from "@module/atoms/store";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { sdkSessionAtom, sessionAtom } from "../atoms/session";
import { lastWebAuthNActionAtom } from "../atoms/webauthn";

/**
 * Get a safe SDK token
 */
export function useGetSafeSdkSession() {
    // Using jotai hook since it's seem to struggle reading from storage directly in some cases
    const currentSdkSession = useAtomValue(sdkSessionAtom);
    const currentSession = useAtomValue(sessionAtom);
    const lastWebAuthnAction = useAtomValue(lastWebAuthNActionAtom);

    /**
     * Generate an SDK session from the last webauthn action if possible
     */
    const genSessionFromWebAuthnAction = useCallback(async () => {
        if (!lastWebAuthnAction) {
            return;
        }

        const encodedSignature = Buffer.from(
            JSON.stringify(lastWebAuthnAction.signature)
        ).toString("base64");
        const { data: session, error } =
            await authenticatedBackendApi.auth.wallet.sdk.fromWebAuthNSignature.post(
                {
                    signature: encodedSignature,
                    msg: lastWebAuthnAction.msg,
                    wallet: lastWebAuthnAction.wallet,
                }
            );
        if (error) {
            console.error(
                "Unable to generate a new token from previous signature",
                error
            );
        }
        if (session) {
            jotaiStore.set(sdkSessionAtom, session);
            return session;
        }
    }, [lastWebAuthnAction]);

    /**
     * Getch the current sdk session or regen a new one
     */
    const query = useQuery({
        // keep in mem for 2min
        gcTime: 2 * 60 * 1000,
        // Keep it stale for 15min
        staleTime: 15 * 60 * 1000,
        queryKey: [
            "sdk-token",
            "get-safe",
            currentSdkSession?.expires?.toString() ?? "no-sdk-token",
            currentSession?.address ?? "no-session",
            lastWebAuthnAction?.wallet ?? "no-last-action",
        ],
        queryFn: async () => {
            // Get the current session status
            const sdkSession = currentSdkSession ?? getSafeSdkSession();

            // If we got a current token, check it's validity
            if (sdkSession) {
                const { data } =
                    await authenticatedBackendApi.auth.wallet.sdk.isValid.get({
                        headers: {
                            "x-wallet-sdk-auth": sdkSession.token,
                        },
                    });
                if (data?.isValid) {
                    return sdkSession;
                }
            }

            // Otherwise, try to craft a new token from the last webauthn action
            await genSessionFromWebAuthnAction();

            // If we got a user session, we can try to generate a new token
            const session = getSafeSession();
            if (!session) {
                return null;
            }

            // Otherwise, craft a new token from the cookie (can fail in third parties context)
            const { data, error } =
                await authenticatedBackendApi.auth.wallet.sdk.generate.get();
            if (error) {
                console.error("Unable to generate a new token", error);
                return null;
            }

            // Save the token and return it
            jotaiStore.set(sdkSessionAtom, data);
            return data;
        },
    });
    return {
        sdkSession: query.data,
        getSdkSession: query.refetch,
        ...query,
    };
}

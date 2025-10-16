import { useQuery } from "@tanstack/react-query";
import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import { authenticatedWalletApi } from "@/common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/common/atoms/session";
import { lastWebAuthNActionAtom } from "@/common/atoms/webauthn";
import { sdkKey } from "@/common/queryKeys/sdk";
import { getSafeSdkSession, getSafeSession } from "@/common/utils/safeSession";

/**
 * Get a safe SDK token
 */
export function useGetSafeSdkSession() {
    // Using jotai hook since it's seem to struggle reading from storage directly in some cases
    const [currentSdkSession, setCurrentSdkSession] = useAtom(sdkSessionAtom);
    const currentSession = useAtomValue(sessionAtom);
    const lastWebAuthnAction = useAtomValue(lastWebAuthNActionAtom);

    /**
     * Generate an SDK session from the last webauthn action if possible
     */
    const genSessionFromWebAuthnAction = useCallback(async () => {
        if (!lastWebAuthnAction) {
            return;
        }

        const encodedSignature = btoa(
            JSON.stringify(lastWebAuthnAction.signature)
        );
        const { data: session, error } =
            await authenticatedWalletApi.auth.sdk.fromWebAuthNSignature.post({
                signature: encodedSignature,
                msg: lastWebAuthnAction.msg,
                wallet: lastWebAuthnAction.wallet,
            });
        if (error) {
            console.error(
                "Unable to generate a new token from previous signature",
                error
            );
        }
        if (session) {
            setCurrentSdkSession(session);
        }
        return session;
    }, [lastWebAuthnAction, setCurrentSdkSession]);

    /**
     * Fetch the current sdk session or regen a new one
     */
    const query = useQuery({
        // keep in mem for 2min
        gcTime: 2 * 60 * 1000,
        // Keep it stale for 15min
        staleTime: 15 * 60 * 1000,
        queryKey: sdkKey.token.bySession(
            currentSession?.address,
            lastWebAuthnAction?.wallet
        ),
        queryFn: async () => {
            // Get the current session status
            const sdkSession = currentSdkSession ?? getSafeSdkSession();

            // If we got a current token, check it's validity
            if (sdkSession) {
                const { data } =
                    await authenticatedWalletApi.auth.sdk.isValid.get({
                        headers: {
                            "x-wallet-sdk-auth": sdkSession.token,
                        },
                    });
                if (data?.isValid) {
                    return sdkSession;
                }
            }

            // Otherwise, try to craft a new token from the last webauthn action
            const sdkSessionFromWebAuthN = await genSessionFromWebAuthnAction();
            if (sdkSessionFromWebAuthN) {
                return sdkSessionFromWebAuthN;
            }

            // If we got a user session, we can try to generate a new token
            const session = getSafeSession();
            if (!session) {
                return null;
            }

            // Otherwise, craft a new token from the cookie (can fail in third parties context)
            const { data, error } =
                await authenticatedWalletApi.auth.sdk.generate.get();
            if (error) {
                console.error("Unable to generate a new token", error);
                return null;
            }

            // Save the token and return it
            setCurrentSdkSession(data);
            return data;
        },
    });
    return {
        sdkSession: query.data,
        getSdkSession: query.refetch,
        ...query,
    };
}

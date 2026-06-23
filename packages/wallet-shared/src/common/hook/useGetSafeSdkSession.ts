import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useStore } from "zustand";
import {
    authenticationStore,
    selectLastWebAuthNAction,
} from "../../stores/authenticationStore";
import {
    selectSdkSession,
    selectSession,
    sessionStore,
} from "../../stores/sessionStore";
import { authenticatedWalletApi } from "../api/backendClient";
import { sdkKey } from "../queryKeys/sdk";
import { getSafeSdkSession, getSafeSession } from "../utils/safeSession";

/**
 * Get a safe SDK token
 */
export function useGetSafeSdkSession() {
    // Using zustand hooks
    const currentSdkSession = useStore(sessionStore, selectSdkSession);
    const currentSession = useStore(sessionStore, selectSession);
    const lastWebAuthnAction = useStore(
        authenticationStore,
        selectLastWebAuthNAction
    );
    const setSdkSession = useStore(
        sessionStore,
        (state) => state.setSdkSession
    );

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
                challenge: lastWebAuthnAction.challenge,
                wallet: lastWebAuthnAction.wallet,
            });
        if (error) {
            console.error(
                "Unable to generate a new token from previous signature",
                error
            );
        }
        if (session) {
            setSdkSession(session);
        }
        return session;
    }, [lastWebAuthnAction, setSdkSession]);

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

            // The current token is missing or invalid. A failed `isValid` no
            // longer wipes the session (see `backendClient` onResponse) — we
            // own recovery here so a transient/stale token can't log the user
            // out. Exhaust every renewal path before dropping anything.
            const sdkSessionFromWebAuthN = await genSessionFromWebAuthnAction();
            if (sdkSessionFromWebAuthN) {
                return sdkSessionFromWebAuthN;
            }

            // Then try to mint from the wallet cookie (can fail in third
            // parties context)
            const session = getSafeSession();
            if (session) {
                const { data, error } =
                    await authenticatedWalletApi.auth.sdk.generate.get();
                if (!error && data) {
                    setSdkSession(data);
                    return data;
                }
                console.error("Unable to generate a new token", error);
            }

            // Renewal exhausted: drop only the stale SDK token, leaving the
            // wallet session intact, so we stop replaying an invalid token.
            if (sdkSession) {
                setSdkSession(null);
            }
            return null;
        },
    });
    return {
        sdkSession: query.data,
        getSdkSession: query.refetch,
        ...query,
    };
}

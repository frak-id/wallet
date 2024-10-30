import { authenticatedBackendApi } from "@/context/common/backendClient";
import { getSafeSession } from "@/module/listener/utils/localStorage";
import { jotaiStore } from "@module/atoms/store";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
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

    const query = useQuery({
        // keep in mem for 2min
        gcTime: 2 * 60 * 1000,
        queryKey: [
            "sdk-token",
            "get-safe",
            currentSdkSession?.expires?.toString() ?? "no-sdk-token",
            currentSession?.address ?? "no-session",
            lastWebAuthnAction?.wallet ?? "no-last-action",
        ],
        queryFn: async () => {
            // If we got a current token, check it's validity
            if (currentSession) {
                const isValid =
                    await authenticatedBackendApi.auth.wallet.sdk.isValid.get({
                        headers: {
                            "x-wallet-sdk-auth": currentSession.token,
                        },
                    });
                if (isValid) {
                    return currentSdkSession;
                }
            }

            // Otherwise, try to craft a new token from the last webauthn action
            if (lastWebAuthnAction) {
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
            }

            // Otherwise, if we don't have any current session, we can early exit (since we won't have any token for the generation)
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
        staleTime: ({ state }) => {
            if (state.data?.expires) {
                // If we got a token, keep it in mem for expiration time less 15min
                const stale = state.data.expires - 15 * 60 * 1000;
                if (stale > Date.now()) {
                    return stale;
                }
            }

            // Default to 15min
            return 15 * 60 * 1000;
        },
    });
    return {
        sdkSession: query.data,
        getSdkSession: query.refetch,
        ...query,
    };
}

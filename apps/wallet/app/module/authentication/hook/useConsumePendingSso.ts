import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { ssoConsumeKey } from "@/module/authentication/atoms/sso";
import { ssoKey } from "@/module/authentication/queryKeys/sso";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { jotaiStore } from "@shared/module/atoms/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import type { Hex } from "viem";
import type { Session } from "../../../types/Session";
import { openPanel } from "../../common/utils/openPanel";
import { trackEvent } from "../../common/utils/trackEvent";

/**
 * hook to consume the sso status
 */
export function useConsumePendingSso({
    trackingId,
    productId,
}: {
    trackingId?: Hex;
    productId: Hex;
}) {
    const consumeKey = useAtomValue(ssoConsumeKey);
    const queryClient = useQueryClient();
    return useQuery({
        enabled: !!trackingId && !!consumeKey,
        queryKey: ssoKey.consume.baseKey,
        async queryFn() {
            if (!(trackingId && consumeKey)) {
                return "error";
            }

            const { data, error } =
                await authenticatedWalletApi.auth.sso.consume.post({
                    id: trackingId,
                    productId,
                    consumeKey: consumeKey.key,
                });
            if (error) {
                console.error(
                    "Error when trying to consume the SSO session",
                    error
                );
                return "error";
            }

            // If the status is good, save the session
            if (data.status === "ok") {
                // Extract a few data
                const { token, sdkJwt, ...authentication } = data.session;
                const session = { ...authentication, token } as Session;

                // Save this last authentication
                await jotaiStore.set(addLastAuthenticationAtom, session);

                // Store the session
                jotaiStore.set(sessionAtom, session);
                jotaiStore.set(sdkSessionAtom, sdkJwt);

                await Promise.allSettled([
                    // Identify the user
                    openPanel?.identify({
                        profileId: session.address,
                        properties: {
                            sessionType: session.type ?? "webauthn",
                            sessionSrc: "sso",
                        },
                    }),
                    // Track the event
                    trackEvent("login-sso", {
                        address: session.address,
                        sessionType: session.type ?? "webauthn",
                        sessionSrc: "sso",
                    }),
                ]);
            }

            // If the status is not-found, remove the sso link query
            if (data.status === "not-found") {
                queryClient.removeQueries({
                    queryKey: ssoKey.link.baseKey,
                    exact: false,
                });
            }

            // Return the overall status
            return data.status;
        },
        refetchOnWindowFocus: true,
        // Refetch every 2 seconds, even if in background
        refetchIntervalInBackground: true,
        refetchInterval(query) {
            const lastStatus = query.state.data;

            // If we know we got an sso registration, just it's in a pending state, refresh every 500ms
            if (lastStatus === "pending") {
                return 500;
            }

            // Otherwise, wait 2sec between each refresh
            return 2000;
        },
    });
}

import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { ssoConsumeKey } from "@/module/authentication/atoms/sso";
import { authenticatedBackendApi } from "@/module/common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { jotaiStore } from "@shared/module/atoms/store";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import type { Hex } from "viem";

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
        queryKey: ["sso", "consume"],
        async queryFn() {
            if (!(trackingId && consumeKey)) {
                return "error";
            }

            const { data, error } =
                await authenticatedBackendApi.auth.wallet.sso.consume.post({
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
                const session = { ...authentication, token };

                // Save this to the last authenticator
                await jotaiStore.set(addLastAuthenticationAtom, {
                    ...authentication,
                    transports:
                        authentication.transports as AuthenticatorTransportFuture[],
                });

                // Store the session
                jotaiStore.set(sessionAtom, session);
                jotaiStore.set(sdkSessionAtom, sdkJwt);
            }

            // If the status is not-found, remove the sso link query
            if (data.status === "not-found") {
                queryClient.removeQueries({
                    queryKey: ["sso", "link"],
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

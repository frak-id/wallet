import {
    authenticatedWalletApi,
    getNotificationAdapter,
    type NotificationInitResult,
} from "@frak-labs/wallet-shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { notificationKey } from "@/module/notification/queryKeys/notification";

export function useNotificationStatus() {
    const adapter = getNotificationAdapter();
    const queryClient = useQueryClient();

    const isSupported = useMemo(() => adapter.isSupported(), [adapter]);

    const { data: localState } = useQuery({
        queryKey: notificationKey.push.localState,
        queryFn: (): Promise<NotificationInitResult> => adapter.initPromise,
        staleTime: Number.POSITIVE_INFINITY,
        enabled: isSupported,
    });

    const { data: hasBackendToken } = useQuery({
        queryKey: notificationKey.push.backendToken,
        queryFn: async () => {
            const result =
                await authenticatedWalletApi.notifications.tokens.hasAny.get();
            return result.data ?? false;
        },
        enabled: isSupported,
    });

    const hasLocalCapability =
        localState?.localToken !== null && localState?.localToken !== undefined;
    const permissionGranted = localState?.permissionGranted ?? false;

    // Reconciliation: keep local and backend states in sync
    useEffect(() => {
        if (!isSupported) return;

        // Local sub exists but backend doesn't know → silent sync
        if (
            hasLocalCapability &&
            hasBackendToken === false &&
            localState?.localToken
        ) {
            authenticatedWalletApi.notifications.tokens
                .put(localState.localToken)
                .then(() =>
                    queryClient.setQueryData(
                        notificationKey.push.backendToken,
                        true
                    )
                )
                .catch(console.warn);
        }

        // Permission revoked but backend still has stale token → silent cleanup
        if (!permissionGranted && hasBackendToken === true) {
            authenticatedWalletApi.notifications.tokens
                .delete()
                .then(() =>
                    queryClient.setQueryData(
                        notificationKey.push.backendToken,
                        false
                    )
                )
                .catch(console.warn);
        }
    }, [
        isSupported,
        hasLocalCapability,
        hasBackendToken,
        permissionGranted,
        localState?.localToken,
        queryClient,
    ]);

    return useMemo(() => {
        if (!isSupported) {
            return { isSupported: false as const };
        }

        return {
            isSupported: true as const,
            permissionGranted,
            hasLocalCapability,
            hasBackendToken: hasBackendToken ?? false,
        };
    }, [isSupported, permissionGranted, hasLocalCapability, hasBackendToken]);
}

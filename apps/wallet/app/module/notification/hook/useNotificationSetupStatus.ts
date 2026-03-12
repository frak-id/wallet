import {
    authenticatedWalletApi,
    type NotificationPermissionStatus,
    notificationAdapter,
    type PushTokenPayload,
} from "@frak-labs/wallet-shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { notificationKey } from "@/module/notification/queryKeys/notification";

const PERMISSION_POLL_INTERVAL = 30_000;

export function useNotificationStatus() {
    const queryClient = useQueryClient();

    const { data: permission } = useQuery({
        queryKey: notificationKey.push.permission,
        queryFn: () => notificationAdapter.getPermissionStatus(),
        staleTime: PERMISSION_POLL_INTERVAL,
        refetchInterval: PERMISSION_POLL_INTERVAL,
        refetchOnWindowFocus: "always",
    });

    const permissionGranted = permission === "granted";

    const { data: localToken } = useQuery({
        queryKey: notificationKey.push.localToken,
        queryFn: () => notificationAdapter.getToken(),
        enabled: permissionGranted,
        staleTime: Number.POSITIVE_INFINITY,
    });

    const { data: hasBackendToken } = useQuery({
        queryKey: notificationKey.push.backendToken,
        queryFn: async () => {
            const result =
                await authenticatedWalletApi.notifications.tokens.hasAny.get();
            return result.data ?? false;
        },
    });

    const hasLocalCapability =
        permissionGranted && localToken !== null && localToken !== undefined;

    useEffect(() => {
        const controller = new AbortController();
        notificationAdapter.events.addEventListener(
            "token-update",
            (e) => {
                console.log("token update", e);
                const token = (e as CustomEvent<PushTokenPayload>).detail;
                queryClient.setQueryData(
                    notificationKey.push.localToken,
                    token
                );
                queryClient.invalidateQueries({
                    queryKey: notificationKey.push.permission,
                });
            },
            { signal: controller.signal }
        );
        return () => controller.abort();
    }, [queryClient]);

    useEffect(() => {
        if (permissionGranted && hasBackendToken === false && localToken) {
            authenticatedWalletApi.notifications.tokens
                .put(localToken)
                .then(() =>
                    queryClient.invalidateQueries({
                        queryKey: notificationKey.push.backendToken,
                    })
                )
                .catch(console.warn);
            return;
        }

        if (!permissionGranted && hasBackendToken === true) {
            authenticatedWalletApi.notifications.tokens
                .delete()
                .then(() =>
                    queryClient.invalidateQueries({
                        queryKey: notificationKey.push.backendToken,
                    })
                )
                .catch(console.warn);
        }
    }, [hasBackendToken, permissionGranted, localToken, queryClient]);

    return useMemo(
        () => ({
            permissionStatus: (permission ??
                "prompt") as NotificationPermissionStatus,
            permissionGranted,
            hasLocalCapability,
            hasBackendToken: hasBackendToken ?? false,
        }),
        [permission, permissionGranted, hasLocalCapability, hasBackendToken]
    );
}

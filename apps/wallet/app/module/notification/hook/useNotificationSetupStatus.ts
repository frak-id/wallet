import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
    type NotificationPermissionStatus,
    notificationAdapter,
    type PushTokenPayload,
} from "@/module/notification/adapter";
import { notificationKey } from "@/module/notification/queryKeys/notification";

const PERMISSION_POLL_INTERVAL = 30_000;

export function useNotificationStatus() {
    const queryClient = useQueryClient();

    const { data: permission } = useQuery({
        queryKey: notificationKey.push.permission,
        queryFn: () => notificationAdapter.getPermissionStatus(),
        refetchInterval: PERMISSION_POLL_INTERVAL,
        refetchOnWindowFocus: "always",
        meta: { storable: false },
    });

    const permissionGranted = permission === "granted";

    const { data: localToken } = useQuery({
        queryKey: notificationKey.push.localToken,
        queryFn: () => notificationAdapter.getToken(),
        enabled: permissionGranted,
        refetchOnWindowFocus: "always",
        meta: { storable: false },
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
                const token = (e as CustomEvent<PushTokenPayload>).detail;
                queryClient.setQueryData(
                    notificationKey.push.localToken,
                    token
                );
                queryClient.setQueryData(
                    notificationKey.push.permission,
                    "granted" satisfies NotificationPermissionStatus
                );
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

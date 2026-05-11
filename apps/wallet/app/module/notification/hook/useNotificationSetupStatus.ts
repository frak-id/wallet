import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
    type NotificationPermissionStatus,
    notificationAdapter,
    type PushTokenPayload,
} from "@/module/notification/adapter";
import { notificationKey } from "@/module/notification/queryKeys/notification";
import {
    notificationOptOutStore,
    selectOptedOut,
} from "@/module/notification/stores/notificationOptOutStore";

const PERMISSION_POLL_INTERVAL = 30_000;

export function useNotificationStatus() {
    const queryClient = useQueryClient();
    const optedOut = notificationOptOutStore(selectOptedOut);

    const { data: permission } = useQuery({
        queryKey: notificationKey.push.permission,
        queryFn: () => notificationAdapter.getPermissionStatus(),
        refetchInterval: PERMISSION_POLL_INTERVAL,
        refetchOnWindowFocus: "always",
        meta: { storable: false },
    });

    const permissionGranted = permission === "granted";
    const hasResolvedPermission = permission !== undefined;

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

    // `optedOut` forces the switch to OFF even when the OS still has
    // permission granted and the FCM token is cached — it represents the
    // user's last explicit intent in the in-app toggle.
    const hasLocalCapability =
        !optedOut &&
        permissionGranted &&
        localToken !== null &&
        localToken !== undefined;
    const isReady =
        hasResolvedPermission &&
        (!permissionGranted || localToken !== undefined);

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
        // Auto re-PUT recovers the "permission flipped on out-of-band" path
        // (user enabled notifications via system Settings without going
        // through the in-app toggle). Skip when the user has explicitly
        // opted out — otherwise toggle-off would re-create the backend
        // token on the next refetch.
        if (
            !optedOut &&
            permissionGranted &&
            hasBackendToken === false &&
            localToken
        ) {
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
    }, [hasBackendToken, permissionGranted, localToken, optedOut, queryClient]);

    return useMemo(
        () => ({
            permissionStatus: (permission ??
                "prompt") as NotificationPermissionStatus,
            permissionGranted,
            isReady,
            hasLocalCapability,
            hasBackendToken: hasBackendToken ?? false,
        }),
        [
            permission,
            permissionGranted,
            isReady,
            hasLocalCapability,
            hasBackendToken,
        ]
    );
}

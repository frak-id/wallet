import {
    authenticatedWalletApi,
    notificationAdapter,
} from "@frak-labs/wallet-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationKey } from "@/module/notification/queryKeys/notification";

export function useSubscribeToPushNotification() {
    const queryClient = useQueryClient();

    const {
        mutate: subscribeToPush,
        mutateAsync: subscribeToPushAsync,
        ...mutationState
    } = useMutation({
        mutationKey: notificationKey.push.subscribe,
        mutationFn: async () => {
            const tokenPayload = await notificationAdapter.subscribe();
            await authenticatedWalletApi.notifications.tokens.put(tokenPayload);
            return tokenPayload;
        },
        onSuccess: (tokenPayload) => {
            queryClient.setQueryData(
                notificationKey.push.permission,
                "granted" as NotificationPermission
            );
            queryClient.setQueryData(
                notificationKey.push.localToken,
                tokenPayload
            );
            queryClient.setQueryData(notificationKey.push.backendToken, true);
        },
    });

    return { subscribeToPush, subscribeToPushAsync, ...mutationState };
}

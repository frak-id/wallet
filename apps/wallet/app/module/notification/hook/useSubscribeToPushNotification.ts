import {
    authenticatedWalletApi,
    getNotificationAdapter,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { notificationKey } from "@/module/notification/queryKeys/notification";

export function useSubscribeToPushNotification() {
    const adapter = getNotificationAdapter();

    const {
        mutate: subscribeToPush,
        mutateAsync: subscribeToPushAsync,
        ...mutationState
    } = useMutation({
        mutationKey: notificationKey.push.subscribe,
        mutationFn: async () => {
            const tokenPayload = await adapter.subscribe();
            await authenticatedWalletApi.notifications.tokens.put(tokenPayload);
            return tokenPayload;
        },
        onSuccess: (tokenPayload, _variables, _onSuccess, { client }) => {
            client.setQueryData(notificationKey.push.localState, {
                permissionGranted: true,
                localToken: tokenPayload,
            });
            client.setQueryData(notificationKey.push.backendToken, true);
        },
    });

    return { subscribeToPush, subscribeToPushAsync, ...mutationState };
}

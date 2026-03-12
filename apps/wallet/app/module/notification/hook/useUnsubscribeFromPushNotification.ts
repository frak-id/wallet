import {
    authenticatedWalletApi,
    getNotificationAdapter,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { notificationKey } from "@/module/notification/queryKeys/notification";

export function useUnsubscribeFromPushNotification() {
    const adapter = getNotificationAdapter();

    const {
        mutate: unsubscribeFromPush,
        mutateAsync: unsubscribeFromPushAsync,
        ...mutationState
    } = useMutation({
        mutationKey: notificationKey.push.unsubscribe,
        mutationFn: async () => {
            await adapter.unsubscribe();
            await authenticatedWalletApi.notifications.tokens.delete();
        },
        onSuccess: (_data, _error, _onSuccess, { client }) => {
            client.setQueryData(
                notificationKey.push.localState,
                (prev: { permissionGranted: boolean } | undefined) => ({
                    permissionGranted: prev?.permissionGranted ?? false,
                    localToken: null,
                })
            );
            client.setQueryData(notificationKey.push.backendToken, false);
        },
    });

    return {
        unsubscribeFromPush,
        unsubscribeFromPushAsync,
        ...mutationState,
    };
}

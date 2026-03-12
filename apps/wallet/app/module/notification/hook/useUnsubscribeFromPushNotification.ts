import {
    authenticatedWalletApi,
    notificationAdapter,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { notificationKey } from "@/module/notification/queryKeys/notification";

export function useUnsubscribeFromPushNotification() {
    const {
        mutate: unsubscribeFromPush,
        mutateAsync: unsubscribeFromPushAsync,
        ...mutationState
    } = useMutation({
        mutationKey: notificationKey.push.unsubscribe,
        mutationFn: async () => {
            await notificationAdapter.unsubscribe();
            await authenticatedWalletApi.notifications.tokens.delete();
        },
        onSuccess: (_data, _variable, _onResult, { client }) => {
            client.invalidateQueries({
                queryKey: notificationKey.push.permission,
            });
            client.invalidateQueries({
                queryKey: notificationKey.push.localToken,
            });
            client.invalidateQueries({
                queryKey: notificationKey.push.backendToken,
            });
        },
    });

    return {
        unsubscribeFromPush,
        unsubscribeFromPushAsync,
        ...mutationState,
    };
}

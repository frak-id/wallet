import {
    authenticatedWalletApi,
    notificationAdapter,
} from "@frak-labs/wallet-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationKey } from "@/module/notification/queryKeys/notification";

export function useUnsubscribeFromPushNotification() {
    const queryClient = useQueryClient();

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
        onSuccess: () => {
            queryClient.setQueryData(
                notificationKey.push.permission,
                "default" as NotificationPermission
            );
            queryClient.setQueryData(notificationKey.push.localToken, null);
            queryClient.setQueryData(notificationKey.push.backendToken, false);
        },
    });

    return {
        unsubscribeFromPush,
        unsubscribeFromPushAsync,
        ...mutationState,
    };
}

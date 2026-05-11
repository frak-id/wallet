import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { notificationAdapter } from "@/module/notification/adapter";
import { notificationKey } from "@/module/notification/queryKeys/notification";
import { notificationOptOutStore } from "@/module/notification/stores/notificationOptOutStore";

export function useUnsubscribeFromPushNotification() {
    const {
        mutate: unsubscribeFromPush,
        mutateAsync: unsubscribeFromPushAsync,
        ...mutationState
    } = useMutation({
        mutationKey: notificationKey.push.unsubscribe,
        mutationFn: async () => {
            // Set the flag BEFORE the async work so the adapter's lazy
            // `fcm.register()` (which can run during the post-mutation
            // localToken refetch) and the backend re-PUT effect both
            // observe the opt-out and stop re-creating the subscription.
            notificationOptOutStore.getState().setOptedOut(true);
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

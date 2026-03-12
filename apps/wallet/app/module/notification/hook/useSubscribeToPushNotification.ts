import {
    authenticatedWalletApi,
    notificationAdapter,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { notificationKey } from "@/module/notification/queryKeys/notification";

export function useSubscribeToPushNotification() {
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
        onSuccess: (tokenPayload, _variable, _onMutate, { client }) => {
            client.invalidateQueries({
                queryKey: notificationKey.push.permission,
            });
            client.setQueryData(notificationKey.push.localToken, tokenPayload);
            client.setQueryData(notificationKey.push.backendToken, true);
        },
    });

    return { subscribeToPush, subscribeToPushAsync, ...mutationState };
}

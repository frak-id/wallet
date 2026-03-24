import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import i18next from "i18next";
import { notificationAdapter } from "@/module/notification/adapter";
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
            await authenticatedWalletApi.notifications.tokens.put({
                ...tokenPayload,
                locale: i18next.language?.split("-")[0],
            });
            return tokenPayload;
        },
        onSuccess: (_tokenPayload, _variable, _onMutate, { client }) => {
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

    return { subscribeToPush, subscribeToPushAsync, ...mutationState };
}

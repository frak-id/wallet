import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import i18next from "i18next";
import { notificationAdapter } from "@/module/notification/adapter";
import { notificationKey } from "@/module/notification/queryKeys/notification";
import { notificationOptOutStore } from "@/module/notification/stores/notificationOptOutStore";

export function useSubscribeToPushNotification() {
    const {
        mutate: subscribeToPush,
        mutateAsync: subscribeToPushAsync,
        ...mutationState
    } = useMutation({
        mutationKey: notificationKey.push.subscribe,
        mutationFn: async () => {
            const tokenPayload = await notificationAdapter.subscribe();
            // Clear the opt-out flag as soon as subscribe() succeeds — the
            // OS-level state now matches "subscribed", so the adapter's
            // lazy register and the backend re-PUT reconciliation should
            // re-engage even if the backend put() below throws.
            notificationOptOutStore.getState().setOptedOut(false);
            await authenticatedWalletApi.notifications.tokens.put({
                ...tokenPayload,
                locale: i18next.language?.split("-")[0],
            });
            return tokenPayload;
        },
        onSuccess: (_tokenPayload, _variable, _onMutate, { client }) => {
            client.invalidateQueries({
                queryKey: notificationKey.push.backendToken,
            });
        },
        // Platform permission/token state (web push or FCM) can change
        // even when the backend put() fails. Invalidate on settled so the
        // UI reflects the actual platform state regardless of mutation
        // success.
        onSettled: (_data, _error, _variable, _onMutate, { client }) => {
            client.invalidateQueries({
                queryKey: notificationKey.push.permission,
            });
            client.invalidateQueries({
                queryKey: notificationKey.push.localToken,
            });
        },
    });

    return { subscribeToPush, subscribeToPushAsync, ...mutationState };
}

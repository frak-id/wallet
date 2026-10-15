import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { unwrapMoneriumResponse } from "@/module/monerium/utils/moneriumErrors";

export function useMoneriumDisconnect() {
    const { mutate, mutateAsync, ...rest } = useMutation({
        mutationFn: async () =>
            unwrapMoneriumResponse(
                await authenticatedWalletApi.monerium.connection.delete()
            ),
        onSuccess: (_data, _variables, _result, { client }) => {
            moneriumStore.getState().reset();
            client.removeQueries({ queryKey: moneriumKey.all });
        },
    });

    return { disconnect: mutate, disconnectAsync: mutateAsync, ...rest };
}

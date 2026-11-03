import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { ibanStore } from "@/module/monerium/store/ibanStore";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { unwrapMoneriumResponse } from "@/module/monerium/utils/moneriumErrors";

export function useMoneriumDisconnect() {
    const { mutate, isPending, error } = useMutation({
        mutationFn: async () =>
            unwrapMoneriumResponse(
                await authenticatedWalletApi.monerium.connection.delete()
            ),
        onSuccess: (_data, _variables, _result, { client }) => {
            moneriumStore.getState().reset();
            // Saved IBANs stay; the next connection merges its beneficiaries again.
            ibanStore.setState({ syncedWallet: null });
            client.resetQueries({ queryKey: moneriumKey.all });
        },
    });

    return { disconnect: mutate, isPending, error };
}

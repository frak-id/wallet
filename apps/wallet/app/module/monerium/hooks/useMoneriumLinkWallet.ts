import { MONERIUM_ADDRESS_LINKING_MESSAGE } from "@frak-labs/app-essentials/monerium";
import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { isSmartAccountDeployed } from "permissionless";
import {
    useClient,
    useConnection,
    useSendTransaction,
    useSignMessage,
} from "wagmi";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import type { MoneriumStatus } from "@/module/monerium/utils/deriveSetupScreen";
import { unwrapMoneriumResponse } from "@/module/monerium/utils/moneriumErrors";

export function useMoneriumLinkWallet() {
    const { address } = useConnection();
    const client = useClient();
    const { mutateAsync: signMessageAsync } = useSignMessage();
    const { mutateAsync: sendTransactionAsync } = useSendTransaction();

    const { mutate, mutateAsync, ...mutationRest } = useMutation({
        mutationFn: async () => {
            if (!address) throw new Error("No wallet connected");
            if (!client) throw new Error("No client available");

            const deployed = await isSmartAccountDeployed(client, address);
            if (!deployed) {
                await sendTransactionAsync({ to: address, value: 0n });
            }

            const signature = await signMessageAsync({
                message: MONERIUM_ADDRESS_LINKING_MESSAGE,
            });

            return unwrapMoneriumResponse(
                await authenticatedWalletApi.monerium.wallet.link.post({
                    signature,
                })
            );
        },
        onSuccess: ({ walletLink }, _variable, _result, { client }) => {
            client.setQueryData<MoneriumStatus>(
                moneriumKey.status,
                (status) => status && { ...status, walletLink }
            );
            client.invalidateQueries({ queryKey: moneriumKey.status });
        },
    });

    return {
        linkWallet: mutate,
        linkWalletAsync: mutateAsync,
        ...mutationRest,
    };
}

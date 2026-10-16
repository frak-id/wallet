import { MONERIUM_ADDRESS_LINKING_MESSAGE } from "@frak-labs/app-essentials/monerium";
import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { isSmartAccountDeployed } from "permissionless";
import { sleep } from "radash";
import type { Address, Client } from "viem";
import { useClient, useConnection, useSendTransaction } from "wagmi";
import { useMoneriumSignMessage } from "@/module/monerium/hooks/useMoneriumSignMessage";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import type { MoneriumStatus } from "@/module/monerium/utils/deriveSetupScreen";
import { unwrapMoneriumResponse } from "@/module/monerium/utils/moneriumErrors";
import { refreshStatusOnStateChange } from "@/module/monerium/utils/refreshStaleStatus";

export const DEPLOYMENT_POLL_MS = 1_000;
const DEPLOYMENT_MAX_POLLS = 15;

/** The receipt can come from a node ahead of the one serving `getCode`; Monerium needs the code. */
async function waitUntilDeployed(client: Client, address: Address) {
    for (let poll = 0; poll < DEPLOYMENT_MAX_POLLS; poll++) {
        if (await isSmartAccountDeployed(client, address)) return;
        await sleep(DEPLOYMENT_POLL_MS);
    }
}

export function useMoneriumLinkWallet() {
    const { address } = useConnection();
    const client = useClient();
    const signMessage = useMoneriumSignMessage();
    const { mutateAsync: sendTransactionAsync } = useSendTransaction();

    const { mutate, mutateAsync, ...mutationRest } = useMutation({
        mutationFn: async () => {
            if (!address) throw new Error("No wallet connected");
            if (!client) throw new Error("No client available");

            const deployed = await isSmartAccountDeployed(client, address);
            if (!deployed) {
                await sendTransactionAsync({ to: address, value: 0n });
                await waitUntilDeployed(client, address);
            }

            const signature = await signMessage(
                MONERIUM_ADDRESS_LINKING_MESSAGE
            );

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
        onError: (error, _variable, _result, { client }) => {
            refreshStatusOnStateChange(error, client);
        },
    });

    return {
        linkWallet: mutate,
        linkWalletAsync: mutateAsync,
        ...mutationRest,
    };
}

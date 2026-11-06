import { useMutation } from "@tanstack/react-query";
import { sendTransaction } from "permissionless/actions/smartAccount";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";
import type { SmartAccount } from "viem/account-abstraction";
import { useConfig, useConnection } from "wagmi";
import { getConnectorClient } from "wagmi/actions";
import { cowSwapKey } from "@/module/cowSwap/queryKeys/cowSwap";
import {
    buildPresignCalls,
    fetchCowQuote,
    postCowPresignOrder,
} from "@/module/cowSwap/utils/cowApi";
import { waitForCowOrder } from "@/module/cowSwap/utils/waitForCowOrder";

type ConnectorClient = Client<Transport, Chain, Account>;

function isSmartAccountClient(
    client: ConnectorClient
): client is Client<Transport, Chain, SmartAccount> {
    return client.account.type === "smart";
}

export type CowSwapParams = {
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
};

export type CowSwapResult = { orderUid: Hex; boughtAmount: bigint };

/** Quotes, pre-signs from the smart account and waits until the CoW order fills. */
export function useCowSwap() {
    const config = useConfig();
    const { address } = useConnection();

    return useMutation({
        mutationKey: cowSwapKey.swap,
        mutationFn: async (params: CowSwapParams): Promise<CowSwapResult> => {
            if (!address) throw new Error("No wallet connected");
            const client = await getConnectorClient(config);
            if (!isSmartAccountClient(client)) {
                throw new Error("CoW pre-sign needs the smart account client");
            }

            // Fresh quote: the preview one may be past its 60s quote-id window.
            const quote = await fetchCowQuote({ ...params, owner: address });
            const orderUid = await postCowPresignOrder(quote, address);
            await sendTransaction(client, {
                calls: buildPresignCalls({
                    sellToken: quote.sellToken,
                    sellAmount: quote.sellAmount + quote.feeAmount,
                    orderUid,
                }),
            });
            const boughtAmount = await waitForCowOrder(orderUid, quote.validTo);
            return { orderUid, boughtAmount };
        },
    });
}

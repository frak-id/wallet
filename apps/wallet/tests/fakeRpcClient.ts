import { createClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";

/** A viem client that batches reads like the app's, answered by `reply` per JSON-RPC id. */
export function createFakeRpcClient(reply: (id: number) => Response) {
    return createClient({
        chain: arbitrumSepolia,
        batch: { multicall: true },
        transport: http("http://rpc.test", {
            retryCount: 0,
            fetchFn: async (_url, init) =>
                reply(JSON.parse(String(init?.body)).id),
        }),
    });
}

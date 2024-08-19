import { getErpcTransport } from "@frak-labs/shared/context/blockchain/transport/erpc-transport";
import { memo } from "radash";
import { http, type Chain, createClient, fallback } from "viem";

export const getPimlicoTransport = memo(
    (chain: Chain) => {
        // Get the pimlico transport
        const pimlicoTransport = http(
            `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
        );

        // Get the erpc transport
        const erpcTransport = getErpcTransport({ chain });

        // Build our overall transport
        return erpcTransport
            ? fallback([erpcTransport, pimlicoTransport])
            : pimlicoTransport;
    },
    { key: (chain: Chain) => `pimlico-transport-${chain.id}` }
);

export const getPimlicoClient = memo(
    (chain: Chain) =>
        createClient({
            chain,
            transport: getPimlicoTransport(chain),
        }),
    { key: (chain: Chain) => `pimlico-client-${chain.id}` }
);

export const getBundlerClient = memo(
    (chain: Chain) => {
        // Get the pimlico transport
        const pimlicoTransport = getPimlicoTransport(chain);

        // Build the pimlico bundler transport and client
        const bundlerClient = createClient({
            chain,
            transport: pimlicoTransport,
        });

        return {
            bundlerTransport: pimlicoTransport,
            bundlerClient,
        };
    },
    { key: (chain: Chain) => `bundler-client-${chain.id}` }
);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};

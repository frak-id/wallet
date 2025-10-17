import { getErpcTransport } from "@frak-labs/app-essentials/blockchain";
import { memo } from "radash";
import { createClient, fallback, http } from "viem";
import { currentChain } from "./provider";

export const getPimlicoTransport = memo(
    () => {
        // Get the pimlico transport
        const pimlicoTransport = http(
            `https://api.pimlico.io/v2/${currentChain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
        );

        // Get the erpc transport
        const erpcTransport = getErpcTransport({ chain: currentChain });

        // Build our overall transport
        return erpcTransport
            ? fallback([erpcTransport, pimlicoTransport])
            : pimlicoTransport;
    },
    { key: () => "pimlico-transport" }
);

export const getPimlicoClient = memo(
    () =>
        createClient({
            chain: currentChain,
            transport: getPimlicoTransport(),
        }),
    { key: () => "pimlico-client" }
);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};

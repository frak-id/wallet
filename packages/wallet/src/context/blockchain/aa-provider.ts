import { currentChain } from "@/context/blockchain/provider";
import { getErpcTransport } from "@frak-labs/shared/context/blockchain/transport/erpc-transport";
import { memo } from "radash";
import { http, createClient, fallback } from "viem";

export const getPimlicoTransport = memo(() => {
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
});

export const getPimlicoClient = memo(() =>
    createClient({
        chain: currentChain,
        transport: getPimlicoTransport(),
    })
);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};

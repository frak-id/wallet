import { KernelExecuteAbi } from "@frak-labs/app-essentials";
import { kernelAddresses } from "@frak-labs/app-essentials";
import { getSenderAddress } from "permissionless/actions";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    concatHex,
    isAddressEqual,
    slice,
    toFunctionSelector,
} from "viem";
import {
    type SmartAccount,
    type SmartAccountImplementation,
    type entryPoint06Abi,
    entryPoint06Address,
} from "viem/account-abstraction";
import { formatAbiItem } from "viem/utils";

export type SmartAccountV06 = SmartAccount<
    SmartAccountImplementation<typeof entryPoint06Abi, "0.6">
>;

/**
 * Check the validity of an existing account address, or fetch the pre-deterministic account address for a kernel smart wallet
 * @param client
 * @param signerPubKey
 * @param initCodeProvider
 */
export const getAccountAddress = async <
    TTransport extends Transport = Transport,
    TChain extends Chain = Chain,
>({
    client,
    initCodeProvider,
}: {
    client: Client<TTransport, TChain>;
    initCodeProvider: () => Hex;
}): Promise<Address> => {
    // Find the init code for this account
    const initCode = initCodeProvider();

    // Get the sender address based on the init code
    return getSenderAddress(client, {
        initCode: concatHex([kernelAddresses.factory, initCode]),
        entryPointAddress: entryPoint06Address,
    });
};

/**
 * Check if the given calldata is already formatted as a call to the wallet
 * @param wallet
 * @param to
 * @param data
 */
export function isAlreadyFormattedCall({
    wallet,
    to,
    data,
}: { wallet: Address; to: Address; data: Hex }) {
    if (!isAddressEqual(to, wallet)) {
        return false;
    }

    const signature = slice(data, 0, 4);
    return KernelExecuteAbi.some((x) => {
        return (
            x.type === "function" &&
            signature === toFunctionSelector(formatAbiItem(x))
        );
    });
}

import { kernelAddresses } from "@/context/blockchain/addresses";
import {
    KernelExecuteAbi,
    KernelInitAbi,
} from "@/context/wallet/abi/kernel-account-abis";
import type { P256PubKey } from "@/types/WebAuthN";
import { ENTRYPOINT_ADDRESS_V06, getSenderAddress } from "permissionless";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    concatHex,
    encodeAbiParameters,
    encodeFunctionData,
    isAddressEqual,
    slice,
    toFunctionSelector,
} from "viem";
import { formatAbiItem } from "viem/utils";

/**
 * The account creation ABI for a kernel smart account (from the KernelFactory)
 */
const createAccountAbi = [
    {
        inputs: [
            {
                internalType: "address",
                name: "_implementation",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "_data",
                type: "bytes",
            },
            {
                internalType: "uint256",
                name: "_index",
                type: "uint256",
            },
        ],
        name: "createAccount",
        outputs: [
            {
                internalType: "address",
                name: "proxy",
                type: "address",
            },
        ],
        stateMutability: "payable",
        type: "function",
    },
] as const;

/**
 * Represent the layout of the calldata used for a webauthn signature
 */
const webAuthNValidatorEnablingLayout = [
    { name: "authenticatorIdHash", type: "bytes32" },
    { name: "x", type: "uint256" },
    { name: "y", type: "uint256" },
] as const;

/**
 * Get the account initialization code for a kernel smart account
 * @param authenticatorId
 * @param signerPubKey
 */
export function getAccountInitCode({
    authenticatorIdHash,
    signerPubKey,
}: {
    authenticatorIdHash: Hex;
    signerPubKey: P256PubKey;
}): Hex {
    if (!signerPubKey) throw new Error("Owner account not found");

    const encodedPublicKey = encodeAbiParameters(
        webAuthNValidatorEnablingLayout,
        [authenticatorIdHash, BigInt(signerPubKey.x), BigInt(signerPubKey.y)]
    );

    // Build the account initialization data
    const initialisationData = encodeFunctionData({
        abi: KernelInitAbi,
        functionName: "initialize",
        args: [kernelAddresses.multiWebAuthnValidator, encodedPublicKey],
    });

    // Build the account init code
    return encodeFunctionData({
        abi: createAccountAbi,
        functionName: "createAccount",
        args: [kernelAddresses.accountLogic, initialisationData, 0n],
    }) as Hex;
}

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
        entryPoint: ENTRYPOINT_ADDRESS_V06,
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

import { tryit } from "radash";
import {
    type Address,
    type Client,
    type Hex,
    concatHex,
    domainSeparator,
    keccak256,
} from "viem";
import { readContract } from "viem/actions";

export type AccountMetadata = {
    name: string;
    version: string;
    chainId: bigint;
    verifyingContract: Address;
};

const GetEip7212DomainAbi = [
    {
        type: "function",
        name: "eip712Domain",
        inputs: [],
        outputs: [
            { name: "fields", type: "bytes1", internalType: "bytes1" },
            { name: "name", type: "string", internalType: "string" },
            { name: "version", type: "string", internalType: "string" },
            { name: "chainId", type: "uint256", internalType: "uint256" },
            {
                name: "verifyingContract",
                type: "address",
                internalType: "address",
            },
            { name: "salt", type: "bytes32", internalType: "bytes32" },
            {
                name: "extensions",
                type: "uint256[]",
                internalType: "uint256[]",
            },
        ],
        stateMutability: "view",
    },
] as const;

/**
 * Fetch the given smart account metadata
 * @param client
 * @param accountAddress
 */
export async function fetchAccountMetadata(
    client: Client,
    accountAddress: Address
): Promise<AccountMetadata> {
    const [, result] = await tryit(() =>
        readContract(client, {
            address: accountAddress,
            abi: GetEip7212DomainAbi,
            functionName: "eip712Domain",
        })
    )();
    if (!result) {
        return getMetadataDefaults(client, accountAddress);
    }
    return {
        name: result[1],
        version: result[2],
        chainId: result[3],
        verifyingContract: result[4],
    };
}

function getMetadataDefaults(client: Client, accountAddress: Address) {
    return {
        name: "Kernel",
        version: "0.2.4",
        chainId: BigInt(client.chain?.id ?? 0),
        verifyingContract: accountAddress,
    };
}

/**
 * Wrap the given message for a signature
 * @param message
 * @param metadata
 */
export function wrapMessageForSignature({
    message,
    metadata,
}: { message: Hex; metadata: AccountMetadata }) {
    // Build the domain separator
    const accountDomainSeparator = domainSeparator({
        domain: {
            name: metadata.name,
            version: metadata.version,
            chainId: Number(metadata.chainId),
            verifyingContract: metadata.verifyingContract,
        },
    });
    return keccak256(concatHex(["0x1901", accountDomainSeparator, message]));
}

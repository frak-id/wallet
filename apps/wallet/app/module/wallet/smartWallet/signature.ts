import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { lastWebAuthNActionAtom } from "@frak-labs/wallet-shared/common/atoms/webauthn";
import type { WebAuthNWallet } from "@frak-labs/wallet-shared/types/WebAuthN";
import { getSignOptions } from "@frak-labs/wallet-shared/wallet/action/signOptions";
import { startAuthentication } from "@simplewebauthn/browser";
import { tryit } from "radash";
import {
    type Address,
    type Client,
    concatHex,
    domainSeparator,
    type Hex,
    keccak256,
    toHex,
} from "viem";
import { readContract } from "viem/actions";
import { formatSignature, parseWebAuthNAuthentication } from "./webAuthN";

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
}: {
    message: Hex;
    metadata: AccountMetadata;
}) {
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

/**
 * Sign a given hash via webauthn
 */
export async function signHashViaWebAuthN({
    hash,
    wallet,
}: {
    hash: Hex;
    wallet: WebAuthNWallet;
}) {
    // Get the signature options from server
    const options = await getSignOptions({
        authenticatorId: wallet.authenticatorId,
        toSign: hash,
    });

    // Start the client authentication
    const authenticationResponse = await startAuthentication({
        optionsJSON: options,
    });

    // Store that in our last webauthn action atom
    jotaiStore.set(lastWebAuthNActionAtom, {
        wallet: wallet.address,
        signature: authenticationResponse,
        msg: options.challenge,
    });

    // Perform the verification of the signature
    const { authenticatorData, clientData, challengeOffset, signature } =
        parseWebAuthNAuthentication(authenticationResponse);

    // Format the signature
    return formatSignature({
        authenticatorIdHash: keccak256(toHex(wallet.authenticatorId)),
        rs: [BigInt(signature.r), BigInt(signature.s)],
        challengeOffset,
        authenticatorData,
        clientData,
    });
}

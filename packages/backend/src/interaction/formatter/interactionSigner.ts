import { productInteractionDiamondAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { Config } from "sst/node/config";
import { type Address, type Hex, concatHex, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract, signTypedData } from "viem/actions";
import { getViemClient } from "../../blockchain/client";

/**
 * Generate an interaction validation
 * @param facetData
 * @param productId
 * @param user
 * @param interactionContract
 */
export async function getInteractionSignature({
    facetData,
                                                  productId,
    user,
    interactionContract,
}: {
    facetData: Hex;
    user: Address;
    productId: bigint;
    interactionContract: Address;
}): Promise<Hex> {
    const client = getViemClient();
    // todo: Should ensure we can generate signature for the given `contentId`

    const interactionHash = keccak256(facetData);

    // Get the current interaction nonce
    const nonce = await getNonce({
        interactionHash,
        user,
        interactionContract,
    });

    // Sign this interaction data
    // todo: Temp, only for testing purpose
    // todo: The signer will be dependant on the contentId, and the signature provider can be an external api endpoint
    const signerAccount = privateKeyToAccount(
        Config.INTERACTION_VALIDATOR_PRIVATE_KEY as Hex
    );

    return await signTypedData(client, {
        account: signerAccount,
        domain: {
            name: "Frak.ProductInteraction",
            version: "0.0.1",
            chainId: client.chain.id,
            verifyingContract: interactionContract,
        },
        types: {
            ValidateInteraction: [
                { name: "productId", type: "uint256" },
                { name: "interactionData", type: "bytes32" },
                { name: "user", type: "address" },
                { name: "nonce", type: "uint256" },
            ],
        },
        primaryType: "ValidateInteraction",
        message: {
            productId,
            interactionData: interactionHash,
            user,
            nonce,
        },
    });
}

const nonceCache = new Map<Hex, bigint>();

async function getNonce({
    interactionHash,
    user,
    interactionContract,
}: { interactionHash: Hex; user: Address; interactionContract: Address }) {
    const cacheKey = keccak256(
        concatHex([interactionContract, interactionHash, user])
    );

    const current = nonceCache.get(cacheKey);
    if (current) {
        nonceCache.set(cacheKey, current + 1n);
        return current + 1n;
    }

    // Otherwise, fetch it and cache it
    const client = getViemClient();
    const nonce = await readContract(client, {
        address: interactionContract,
        abi: productInteractionDiamondAbi,
        functionName: "getNonceForInteraction",
        args: [interactionHash, user],
    });
    nonceCache.set(cacheKey, nonce);
    return nonce;
}

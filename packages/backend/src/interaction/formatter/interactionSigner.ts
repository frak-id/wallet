import { productInteractionDiamondAbi } from "@frak-labs/constant";
import { type Address, type Hex, concatHex, keccak256 } from "viem";
import { readContract, signTypedData } from "viem/actions";
import { getViemClient } from "../../blockchain/client";
import { getProductSpecificAccount } from "../signer/productSigner";

const interactionValidatorRoles = 1n << 4n;

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
    const interactionHash = keccak256(facetData);

    // Get the current interaction nonce
    const nonce = await getNonce({
        interactionHash,
        user,
        interactionContract,
    });

    // Get the signer for this product
    const signerAccount = await getProductSpecificAccount({ productId });

    // Check if the signer has the required role
    const hasSignerRole = await readContract(client, {
        abi: productInteractionDiamondAbi,
        address: interactionContract,
        functionName: "hasAllRoles",
        args: [signerAccount.address, interactionValidatorRoles],
    });
    if (!hasSignerRole) {
        throw new Error("Signer does not have the required role");
    }

    // Build the typed data
    const typedData = {
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
    } as const;

    // Sign the typed data
    return await signTypedData(client, {
        account: signerAccount,
        ...typedData,
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

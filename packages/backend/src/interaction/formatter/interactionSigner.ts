import { contentInteractionDiamondAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { Config } from "sst/node/config";
import { type Address, type Hex, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract, signTypedData } from "viem/actions";
import { getViemClient } from "../client/viem";

/**
 * Generate an interaction validation
 * @param facetData
 * @param contentId
 * @param user
 * @param interactionContract
 */
export async function getInteractionSignature({
    facetData,
    contentId,
    user,
    interactionContract,
}: {
    facetData: Hex;
    user: Address;
    contentId: bigint;
    interactionContract: Address;
}): Promise<Hex> {
    const client = getViemClient();
    // todo: Should ensure we can generate signature for the given `contentId`

    const interactionHash = keccak256(facetData);

    // Get the current interaction nonce
    const nonce = await readContract(client, {
        address: interactionContract,
        abi: contentInteractionDiamondAbi,
        functionName: "getNonceForInteraction",
        args: [interactionHash, user],
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
            name: "Frak.ContentInteraction",
            version: "0.0.1",
            chainId: client.chain.id,
            verifyingContract: interactionContract,
        },
        types: {
            ValidateInteraction: [
                { name: "contentId", type: "uint256" },
                { name: "interactionData", type: "bytes32" },
                { name: "user", type: "address" },
                { name: "nonce", type: "uint256" },
            ],
        },
        primaryType: "ValidateInteraction",
        message: {
            contentId,
            interactionData: interactionHash,
            user,
            nonce,
        },
    });
}

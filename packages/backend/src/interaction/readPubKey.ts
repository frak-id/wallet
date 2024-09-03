import { type Address, type Hex, isHex } from "viem";
import {
    getInteractionExecutorAccount,
    getProductSpecificAccount,
} from "./signer/productSigner";

/**
 * The event for reading a public key
 */
type ReadPubKeyEvent = Readonly<{
    productId?: Hex;
    type?: "interaction-executor";
}>;
type ReadPubKeyResult = Readonly<{
    pubKey: Address;
}>;

export async function handler(
    event: ReadPubKeyEvent
): Promise<ReadPubKeyResult> {
    console.log("Reading public key for event", event);

    // Case for product id
    if (event.productId) {
        if (!isHex(event.productId)) {
            throw new Error("Invalid productId");
        }
        const account = await getProductSpecificAccount({
            productId: BigInt(event.productId),
        });
        return { pubKey: account.address };
    }

    // Case for type
    if (event.type === "interaction-executor") {
        const account = await getInteractionExecutorAccount();
        return { pubKey: account.address };
    }

    // Invalid event
    throw new Error("Invalid event");
}

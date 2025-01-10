import { type Hex, concatHex, encodeAbiParameters, pad, toHex } from "viem";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import type { PreparedInteraction } from "../types";

/**
 * Purchase interactions allow you to track user purchases on your platform.
 * After setting up these interactions, you can create acquisition campaign based on the user purchase  (starting a new one, completed, or even purchase dropped).
 *
 * :::info
 *   To properly handle purchase interactions, ensure that the "Purchase" product type is enabled in your Business dashboard, and that you have set up everything correctly in the `Purchasetracker` section.
 * :::
 *
 * :::note
 * The `purchaseId` is used on both interactions. It can be computed like this:
 *
 * ```ts
 * const purchaseId = keccak256(concatHex([productId, toHex(externalPurchaseId)]));
 * ```
 *
 * With:
 * - `productId`: The id of your product, you can find it in the product dashboard.
 * - `externalPurchaseId`: The id of the purchase in your system (e.g. the shopify `order_id`).
 * :::
 *
 * @description Encode purchase related user interactions
 *
 * @group Interactions Encoder
 *
 * @see {@link !actions.sendInteraction | `sendInteraction()`} Action used to send the prepared interaction to the Frak Wallet
 * @see {@link PreparedInteraction} The prepared interaction object that can be sent
 * @see {@link !actions.trackPurchaseStatus | `trackPurchaseStatus()`} Action that will automatically send the purchase upon completion
 * @see [Purchase Webhooks](/wallet-sdk/references-api/webhook) Webhooks to be implemented on your side to confirm a purchase
 * @see [Purchase Proof](/wallet-sdk/references-api/purchaseProof) Get a merklee proof for the purchase
 */
export const PurchaseInteractionEncoder = {
    /**
     * Encode a start purchase interaction
     * @param args
     * @param args.purchaseId - The id of the purchase that is being started.
     */
    startPurchase({ purchaseId }: { purchaseId: Hex }): PreparedInteraction {
        const interactionData = concatHex([
            interactionTypes.purchase.started,
            pad(purchaseId, { size: 32 }),
        ]);
        return {
            handlerTypeDenominator: toHex(productTypes.purchase),
            interactionData,
        };
    },

    /**
     * Encode a complete purchase interaction
     * @param args
     * @param args.purchaseId - The id of the purchase that is being completed.
     * @param args.proof - The merkle proof that the user has completed the purchase (see [Purchase Webhooks](/wallet-sdk/references-api/webhook) for more details).
     */
    completedPurchase({
        purchaseId,
        proof,
    }: { purchaseId: Hex; proof: Hex[] }): PreparedInteraction {
        const innerData = encodeAbiParameters(
            [{ type: "uint256" }, { type: "bytes32[]" }],
            [BigInt(purchaseId), proof]
        );
        const interactionData = concatHex([
            interactionTypes.purchase.completed,
            innerData,
        ]);
        return {
            handlerTypeDenominator: toHex(productTypes.purchase),
            interactionData,
        };
    },

    /**
     * Encode an unsafe complete purchase interaction (when we can't provide the proof)
     * @param args
     * @param args.purchaseId - The id of the purchase that is being completed.
     */
    unsafeCompletedPurchase({
        purchaseId,
    }: { purchaseId: Hex }): PreparedInteraction {
        const interactionData = concatHex([
            interactionTypes.purchase.completed,
            pad(purchaseId, { size: 32 }),
        ]);
        return {
            handlerTypeDenominator: toHex(productTypes.purchase),
            interactionData,
        };
    },
};

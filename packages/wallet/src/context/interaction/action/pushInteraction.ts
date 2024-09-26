"use client";
import type { PreparedInteraction } from "@frak-labs/nexus-sdk/core";
import { backendApi } from "@frak-labs/shared/context/server";
import type { Address, Hex } from "viem";

type InteractionToPush = {
    productId: Hex;
    interaction: PreparedInteraction;
    submittedSignature?: Hex;
};

/**
 * Try to push an interaction for the given wallet via an interaction
 */
export async function pushInteraction({
    wallet,
    toPush,
}: {
    wallet: Address;
    toPush: InteractionToPush;
}) {
    console.log("Pushing interaction", toPush);
    const { data, error, response, ...other } =
        await backendApi.nexus.interactions.push.post({
            interactions: [
                {
                    wallet,
                    productId: toPush.productId,
                    interaction: toPush.interaction,
                    signature: toPush.submittedSignature,
                },
            ],
        });
    console.log("body", {
        body: {
            wallet,
            productId: toPush.productId,
            interaction: toPush.interaction,
            signature: toPush.submittedSignature,
        },
    });
    console.log("Pushed interaction", {
        data,
        other,
    });
    return data?.[0];
}

/**
 * Try to push an interaction for the given wallet via an interaction
 */
export async function pushInteractions({
    wallet,
    toPush,
}: {
    wallet: Address;
    toPush: InteractionToPush[];
}): Promise<string[]> {
    // Craft every interactions events message
    const { data } = await backendApi.nexus.interactions.push.post({
        interactions: toPush.map((interaction) => ({
            wallet,
            productId: interaction.productId,
            interaction: interaction.interaction,
            signature: interaction.submittedSignature,
        })),
    });
    return data ?? [];
}

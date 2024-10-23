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
    sdkToken,
}: {
    wallet: Address;
    toPush: InteractionToPush;
    sdkToken: string;
}) {
    const { data, error } = await backendApi.interactions.push.post(
        {
            interactions: [
                {
                    wallet,
                    productId: toPush.productId,
                    interaction: toPush.interaction,
                    signature: toPush.submittedSignature,
                },
            ],
        },
        {
            headers: {
                "x-wallet-sdk-auth": sdkToken,
            },
        }
    );
    if (error) {
        console.error("Unable to push the interactions", error);
        return undefined;
    }
    return data?.[0];
}

/**
 * Try to push an interaction for the given wallet via an interaction
 */
export async function pushInteractions({
    wallet,
    toPush,
    sdkToken,
}: {
    wallet: Address;
    toPush: InteractionToPush[];
    sdkToken: string;
}): Promise<string[]> {
    // Craft every interactions events message
    const { data } = await backendApi.interactions.push.post(
        {
            interactions: toPush.map((interaction) => ({
                wallet,
                productId: interaction.productId,
                interaction: interaction.interaction,
                signature: interaction.submittedSignature,
            })),
        },
        {
            headers: {
                "x-wallet-sdk-auth": sdkToken,
            },
        }
    );
    return data ?? [];
}

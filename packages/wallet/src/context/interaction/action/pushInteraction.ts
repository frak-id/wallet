"use server";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { PreparedInteraction } from "@frak-labs/nexus-sdk/core";
import { DI } from "@frak-labs/shared/context/utils/di";
import { parallel } from "radash";
import type { Address, Hex } from "viem";

type InteractionToPush = {
    contentId: Hex;
    interaction: PreparedInteraction;
    submittedSignature?: Hex;
};

const getSqsClient = DI.registerAndExposeGetter({
    id: "SqsClient",
    isAsync: false,
    getter: () =>
        new SQSClient({
            region: "eu-west-1",
        }),
});

/**
 * Try to push an interaction for the given wallet via an interaction
 */
export async function pushInteraction({
    wallet,
    toPush,
}: {
    wallet: Address;
    toPush: InteractionToPush | InteractionToPush[];
}) {
    console.log("Pushing interaction", toPush);

    // Craft every interactions events message
    const messages: SendMessageCommand[] = [];
    if (!Array.isArray(toPush)) {
        messages.push(mapToMessage({ wallet, toPush }));
    } else {
        messages.push(
            ...toPush.map((toPush) => mapToMessage({ wallet, toPush }))
        );
    }

    // Get our SQS client
    const sqsClient = getSqsClient();

    // And send every the messages to the queue
    const results = await parallel(4, messages, async (message) =>
        sqsClient.send(message)
    );
    console.log("Pushed interactions", results);
}

/**
 * Type of an interaction event, waited by the queue
 */
type InteractionEvent = {
    wallet: Address;
    contentId: Hex;
    interaction: {
        handlerTypeDenominator: Hex;
        interactionData: Hex;
    };
    signature?: Hex;
};

/**
 * Map an interaction to a SQS Message
 * @param wallet
 * @param toPush
 */
function mapToMessage({
    wallet,
    toPush,
}: { wallet: Address; toPush: InteractionToPush }): SendMessageCommand {
    const event: InteractionEvent = {
        wallet,
        contentId: toPush.contentId,
        interaction: toPush.interaction,
        signature: toPush.submittedSignature,
    };
    return new SendMessageCommand({
        MessageBody: JSON.stringify(event),
        QueueUrl: process.env.INTERACTION_QUEUE_URL,
    });
}

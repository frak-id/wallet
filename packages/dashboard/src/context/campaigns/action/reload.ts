"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DI } from "@frak-labs/shared/context/utils/di";
import type { Address } from "viem";

const getSqsClient = DI.registerAndExposeGetter({
    id: "SqsClient",
    isAsync: false,
    getter: () =>
        new SQSClient({
            region: "eu-west-1",
        }),
});

/**
 * Ask to reload a campaign from
 * @param campaignAddress
 */
export async function reloadCampaign({
    campaignAddress,
}: { campaignAddress: Address }) {
    const session = await getSafeSession();

    // Build the message we will send
    const message = new SendMessageCommand({
        QueueUrl: process.env.CAMPAIGN_RELOAD_QUEUE_URL,
        MessageBody: JSON.stringify({
            campaign: campaignAddress,
            requester: session.wallet,
        }),
    });

    // And send it
    const result = await getSqsClient().send(message);
    console.log("Sent reload request", { result });
}

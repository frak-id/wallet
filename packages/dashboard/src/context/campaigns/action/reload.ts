"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { getSqsClient } from "@/context/common/awsClients";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import type { Address } from "viem";

/**
 * Ask to reload a campaign from
 * @param campaignAddress
 */
export async function addCampaignFund({
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

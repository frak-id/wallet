import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { first } from "radash";
import { type Hex, parseAbi, parseEventLogs } from "viem";
import { getTransactionReceipt } from "viem/actions";
import { getSession } from "@/context/auth/session";
import { viemClient } from "@/context/blockchain/provider";
import type { DraftCampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import type { Campaign } from "@/types/Campaign";

/**
 * Save a campaign draft
 * @param campaign
 */
async function saveCampaignDraftInternal(
    campaign: Partial<Campaign>
): Promise<{ id?: string }> {
    const session = await getSession();
    if (!session) {
        throw new Error("No current session found");
    }

    // Build the partial document
    const draftDocument: DraftCampaignDocument = {
        ...campaign,
        creator: session.wallet,
        state: {
            key: "draft",
        },
    };

    // Insert it
    const repository = await getCampaignRepository();
    const finalDraft = await repository.upsertDraft(draftDocument);
    return {
        id: finalDraft?._id?.toHexString(),
    };
}

/**
 * Action used to update the campaign state
 * @param campaignId
 * @param txHash
 */
async function updateCampaignStateInternal({
    campaignId,
    txHash,
}: {
    campaignId: string;
    txHash?: Hex;
}) {
    const id = ObjectId.createFromHexString(campaignId);
    const repository = await getCampaignRepository();

    // If no tx hash, just insert it with creation failed status'
    if (!txHash) {
        await repository.updateState(id, {
            key: "creationFailed",
        });
        return;
    }

    // Otherwise, find the deployed address in the logs of the transaction
    const receipt = await getTransactionReceipt(viemClient, {
        hash: txHash,
    });
    const parsedLogs = parseEventLogs({
        abi: parseAbi(["event CampaignCreated(address campaign)"]),
        eventName: "CampaignCreated",
        logs: receipt.logs,
        strict: true,
    });
    const address = first(parsedLogs)?.args?.campaign;
    if (!address) {
        console.error("No address found in the logs", receipt.logs);
        await repository.updateState(id, {
            key: "creationFailed",
        });
        return;
    }

    // Set the success state
    await repository.updateState(id, {
        key: "created",
        txHash,
        address,
    });
}

/**
 * Server function to save a campaign draft
 */
export const saveCampaignDraft = createServerFn({ method: "POST" })
    .inputValidator((input: { campaign: Partial<Campaign> }) => input)
    .handler(async ({ data }) => {
        return saveCampaignDraftInternal(data.campaign);
    });

/**
 * Server function to update campaign state
 */
export const updateCampaignState = createServerFn({ method: "POST" })
    .inputValidator((input: { campaignId: string; txHash?: Hex }) => input)
    .handler(async ({ data }) => {
        return updateCampaignStateInternal({
            campaignId: data.campaignId,
            txHash: data.txHash,
        });
    });

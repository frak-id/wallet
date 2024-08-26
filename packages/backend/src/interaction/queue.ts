import { interactionDelegatorAbi } from "@frak-labs/shared/context/blockchain/abis/kernel-v2-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import type { SQSEvent } from "aws-lambda";
import type { SQSBatchResponse } from "aws-lambda/trigger/sqs";
import { parallel, sift, tryit } from "radash";
import * as solady from "solady";
import { Handler } from "sst/context";
import { Config } from "sst/node/config";
import { type Address, type Hex, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { estimateFeesPerGas, sendTransaction } from "viem/actions";
import { getViemClient } from "../blockchain/client";
import { recordToInteraction } from "./formatter/recordFormatter";

/**
 * Our invocation queue handler
 */
export const handler = Handler(
    "sqs",
    async (event: SQSEvent): Promise<SQSBatchResponse> => {
        // Map each records into interactions
        const interactionsData = await parallel(
            4,
            event.Records,
            recordToInteraction
        );

        // Get our interactions ready items
        const interactionsReady = sift(
            interactionsData
                .filter((out) => out.data !== null)
                .map((interactions) => interactions.data)
        );
        console.log(`Will process ${interactionsReady.length} interactions`);

        // If no result out of the mapping, early exit
        if (interactionsReady.length === 0) {
            return {
                batchItemFailures: interactionsData.map((out) => ({
                    itemIdentifier: out.id,
                })),
            };
        }

        // Send them
        const [error, txHash] = await tryit(() =>
            pushInteractions(interactionsReady)
        )();

        // If we got an error, or no tx hash, exit and mark all the item as failed
        if (error || !txHash) {
            console.error("Failed to push interactions", { error });
            return {
                batchItemFailures: interactionsData.map((out) => ({
                    itemIdentifier: out.id,
                })),
            };
        }

        // Otherwise, just log the success and return the failed items from the mapping
        console.log(
            `Pushed all the ${interactionsReady.length} interactions on txs ${txHash}`,
            { txHash }
        );

        // Extract all the items that failed during preparation
        const mappingFailedId = interactionsData
            .filter((out) => out.data === null)
            .map((out) => out.id);

        // Tell which items are to retry
        return {
            batchItemFailures: mappingFailedId.map((id) => ({
                itemIdentifier: id,
            })),
        };
    }
);

/**
 * Push a list of interactions
 * @param interactions
 */
async function pushInteractions(
    interactions: {
        wallet: Address;
        contentId: bigint;
        interactionTx: Hex;
    }[]
) {
    // Prepare the execution data
    const executeNoBatchData = encodeFunctionData({
        abi: interactionDelegatorAbi,
        functionName: "execute",
        args: [
            interactions.map((inter) => ({
                wallet: inter.wallet,
                interaction: {
                    contentId: inter.contentId,
                    data: inter.interactionTx,
                },
            })),
        ],
    });

    // Compress it
    const compressedExecute = solady.LibZip.cdCompress(
        executeNoBatchData
    ) as Hex;

    // The executor that will submit the interactions
    // todo: Should be replaced with a kms one
    const executorAccount = privateKeyToAccount(
        Config.AIRDROP_PRIVATE_KEY as Hex
    );

    // Estimate the gas
    const { maxFeePerGas, maxPriorityFeePerGas } = await estimateFeesPerGas(
        getViemClient()
    );

    // And send it
    return await sendTransaction(getViemClient(), {
        account: executorAccount,
        to: addresses.interactionDelegator,
        data: compressedExecute,
        // We will pay 40% more gas than the estimation, to ensure proper inclusion
        maxFeePerGas: (maxFeePerGas * 140n) / 100n,
        // We will pay 25% more priority fee than the estimation, to ensure proper inclusion
        maxPriorityFeePerGas: (maxPriorityFeePerGas * 125n) / 100n,
    });
}

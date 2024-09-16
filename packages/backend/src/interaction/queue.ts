import { addresses, interactionDelegatorAbi } from "@frak-labs/app-essentials";
import type { SQSEvent } from "aws-lambda";
import type { SQSBatchResponse } from "aws-lambda/trigger/sqs";
import { all, parallel, sift, tryit } from "radash";
import * as solady from "solady";
import { Handler } from "sst/context";
import { type Address, type Hex, encodeFunctionData } from "viem";
import { estimateFeesPerGas, estimateGas, sendTransaction } from "viem/actions";
import { getViemClient } from "../blockchain/client";
import { recordToInteraction } from "./formatter/recordFormatter";
import {
    getInteractionExecutorAccount,
    initProductInteractionSigner,
} from "./signer/productSigner";

/**
 * Our invocation queue handler
 */
export const handler = Handler(
    "sqs",
    async (event: SQSEvent): Promise<SQSBatchResponse> => {
        await initProductInteractionSigner();

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
        productId: bigint;
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
                    productId: inter.productId,
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
    const executorAccount = await getInteractionExecutorAccount();

    // Estimate the gas consumption and price
    const {
        gas,
        fees: { maxFeePerGas, maxPriorityFeePerGas },
    } = await all({
        gas: estimateGas(getViemClient(), {
            account: executorAccount,
            to: addresses.interactionDelegator,
            data: compressedExecute,
        }),
        fees: estimateFeesPerGas(getViemClient()),
    });

    // And send it
    return await sendTransaction(getViemClient(), {
        account: executorAccount,
        to: addresses.interactionDelegator,
        data: compressedExecute,
        // We will provide 50% more gas than the estimation, to ensure proper inclusion
        gas: (gas * 150n) / 100n,
        // We will pay 40% more gas than the estimation, to ensure proper inclusion
        maxFeePerGas: (maxFeePerGas * 140n) / 100n,
        // We will pay 25% more priority fee than the estimation, to ensure proper inclusion
        maxPriorityFeePerGas: (maxPriorityFeePerGas * 125n) / 100n,
    });
}

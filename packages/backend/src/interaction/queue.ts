import { kernelAddresses } from "@frak-labs/nexus-wallet/src/context/blockchain/addresses";
import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { interactionDelegatorAbi } from "@frak-labs/nexus-wallet/src/context/wallet/abi/kernel-v2-abis";
import type { SQSEvent } from "aws-lambda";
import type { SQSBatchResponse } from "aws-lambda/trigger/sqs";
import { parallel, sift } from "radash";
import * as solady from "solady";
import { Handler } from "sst/context";
import { Config } from "sst/node/config";
import { type Address, type Hex, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sendTransaction } from "viem/actions";
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

        // Send them
        const txHash = await pushInteractions(interactionsReady);
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

    // And send it
    return await sendTransaction(frakChainPocClient, {
        account: executorAccount,
        to: kernelAddresses.interactionDelegator,
        data: compressedExecute,
    });
}

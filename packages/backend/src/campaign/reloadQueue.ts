import { addresses } from "@frak-labs/app-essentials";
import type { SQSEvent } from "aws-lambda";
import type { SQSBatchResponse } from "aws-lambda/trigger/sqs";
import { parallel, sift, sleep } from "radash";
import { Handler } from "sst/context";
import { Config } from "sst/node/config";
import {
    type Address,
    type Hex,
    encodeFunctionData,
    erc20Abi,
    parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract, sendTransaction } from "viem/actions";
import { getViemClient } from "../blockchain/client";

type ReloadRequest = {
    campaign: Address;
    requester: Address;
};

/**
 * Our reload queue handler
 */
export const handler = Handler(
    "sqs",
    async (event: SQSEvent): Promise<SQSBatchResponse> => {
        // Map each records into campaign address request
        const reloadRequests = sift(
            event.Records.map((record) => {
                const body = JSON.parse(record.body) as ReloadRequest;
                if (!(body.campaign && body.requester)) {
                    return null;
                }
                return body;
            })
        );

        // Perform the campaign reloading
        await parallel(1, reloadRequests, reloadCampaign);

        return {
            batchItemFailures: [],
        };
    }
);

const mintAbi = {
    type: "function",
    inputs: [
        { name: "_to", internalType: "address", type: "address" },
        { name: "_amount", internalType: "uint256", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
} as const;

/**
 * Perform the campaign reload
 * @param reloadRequest
 */
async function reloadCampaign(reloadRequest: ReloadRequest) {
    // Check the current campaign balance (if more than 1000 ether don't reload it)
    const balance = await readContract(getViemClient(), {
        abi: erc20Abi,
        address: addresses.mUsdToken,
        functionName: "balanceOf",
        args: [reloadRequest.campaign],
    });
    if (balance > parseEther("1000")) {
        return;
    }

    // Prepare and send our reload transaction
    const executorAccount = privateKeyToAccount(
        Config.AIRDROP_PRIVATE_KEY as Hex
    );
    await sendTransaction(getViemClient(), {
        account: executorAccount,
        to: addresses.mUsdToken,
        data: encodeFunctionData({
            abi: [mintAbi],
            functionName: "mint",
            args: [reloadRequest.campaign, parseEther("1000")],
        }),
    });
    await sleep(200);
}

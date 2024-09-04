"use server";

import { getLambdaClient } from "@/context/common/awsClients";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { memo } from "radash";
import type { Address, Hex } from "viem";

/**
 * Get a pubkey, within a memo context
 */
const getPubKey = memo(
    async (args: { productId?: Hex; type?: "interaction-executor" }) => {
        // Get the lambda client
        const lambdaClient = getLambdaClient();

        // Perform the call
        const result = await lambdaClient.send(
            new InvokeCommand({
                FunctionName: process.env.READ_PUBLIC_KEY_FUNCTION_NAME,
                InvocationType: "RequestResponse",
                LogType: "None",
                Payload: JSON.stringify(args),
            })
        );

        // Check that we got stuff in our response
        if (result.StatusCode !== 200 || !result.Payload) {
            return undefined;
        }

        // Parse the uint8 array payload into the json object
        const parsed = JSON.parse(new TextDecoder().decode(result.Payload)) as {
            pubKey: Address;
        };
        return parsed?.pubKey;
    }
);

/**
 * Get the managed validator public key for the given product id
 * @param productId
 */
export async function getManagedValidatorPublicKey({
    productId,
}: { productId: Hex }): Promise<{
    productPubKey?: Address;
    interactionExecutorPubKey?: Address;
}> {
    const productPubKey = await getPubKey({ productId });
    const interactionExecutorPubKey = await getPubKey({
        type: "interaction-executor",
    });

    return {
        productPubKey,
        interactionExecutorPubKey,
    };
}

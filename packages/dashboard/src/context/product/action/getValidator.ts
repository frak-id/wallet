"use server";

import { getLambdaClient } from "@/context/common/awsClients";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import type { Address, Hex } from "viem";

/**
 * Get the managed validator public key for the given product id
 * @param productId
 */
export async function getManagedValidatorPublicKey({
    productId,
}: { productId: Hex }): Promise<Address | undefined> {
    // Get the lambda client
    const lambdaClient = getLambdaClient();

    // Perform the call
    const result = await lambdaClient.send(
        new InvokeCommand({
            FunctionName: process.env.READ_PUBLIC_KEY_FUNCTION_NAME,
            InvocationType: "RequestResponse",
            LogType: "None",
            Payload: JSON.stringify({
                productId,
            }),
        })
    );

    // Check that we got stuff in our response
    if (result.StatusCode !== 200 || !result.Payload) {
        return undefined;
    }

    // Parse the uint8 array payload into the json object
    const payload = JSON.parse(new TextDecoder().decode(result.Payload)) as {
        pubKey: Address;
    };
    return payload?.pubKey;
}

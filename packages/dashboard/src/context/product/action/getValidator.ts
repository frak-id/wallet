"use server";

import type { Hex } from "viem";
import {getLambdaClient} from "@/context/common/awsClients";
import {InvokeCommand} from "@aws-sdk/client-lambda";

/**
 * Get the managed validator public key for the given product id
 * @param productId
 */
export async function getManagedValidatorPublicKey({
    productId,
}: { productId: Hex }) {
    // Get the lambda client
    const lambdaClient = getLambdaClient();

    // Perform the call
    const result = await lambdaClient.send(new InvokeCommand({
        FunctionName: process.env.READ_PUBLIC_KEY_FUNCTION_NAME,
        InvocationType: "RequestResponse",
        LogType: "None",
        Payload: JSON.stringify({
            productId,
        }),
    }));

    // Log the result
    console.log("Got managed validator public key", { result });


    return "0x1234567890";
}

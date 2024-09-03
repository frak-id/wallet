import { SQSClient } from "@aws-sdk/client-sqs";
import { memo } from "radash";
import {LambdaClient} from "@aws-sdk/client-lambda";

/**
 * Get an AWS sqs client
 */
export const getSqsClient = memo(
    () =>
        new SQSClient({
            region: "eu-west-1",
        })
);

/**
 * Get an AWS lambda client
 */
export const getLambdaClient = memo(
    () =>
        new LambdaClient({
            region: "eu-west-1",
        })
);

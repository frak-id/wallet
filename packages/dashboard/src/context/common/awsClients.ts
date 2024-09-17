import { LambdaClient } from "@aws-sdk/client-lambda";
import { memo } from "radash";

/**
 * Get an AWS lambda client
 */
export const getLambdaClient = memo(
    () =>
        new LambdaClient({
            region: "eu-west-1",
        }),
    { key: () => "lambda-client" }
);

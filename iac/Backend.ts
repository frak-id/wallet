import { Duration } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Cron, Queue, use } from "sst/constructs";
import type { StackContext } from "sst/constructs";
import { ConfigStack } from "./Config";

/**
 * Define backend stack
 * @param ctx
 * @constructor
 */
export function BackendStack(ctx: StackContext) {
    // interactionsResources(ctx);
    newsResources(ctx);
}

/**
 * Define all of our interactions resources
 * @param stack
 */
export function interactionsResources({ stack }: StackContext) {
    // todo: split queue in half? Like interaction validator queue then interaction processor queue?
    // todo: Move sensitive stuff here? like airdropper and stuff?
    // todo: Should some part of business stuff moved here also? Like content minting?
    // Interaction handling stuff
    const interactionQueue = new Queue(stack, "InteractionQueue", {
        consumer: {
            function: {
                handler: "packages/backend/src/interaction/queue.handler",
                timeout: "15 minutes",
            },
            cdk: {
                eventSource: {
                    // Maximum amount of item sent to the function (at most 200 interactions)
                    batchSize: 200,
                    // Wait at most 2min to push the interactions
                    maxBatchingWindow: Duration.minutes(2),
                    // Allow partial failures
                    reportBatchItemFailures: true,
                    // Don't allow more than 4 parallel executions
                    maxConcurrency: 4,
                },
            },
        },
    });
    stack.addOutputs({
        InteractionQueueId: interactionQueue.id,
    });
}

/**
 * Define all of our news demo resources
 * @param stack
 */
function newsResources({ stack }: StackContext) {
    const { mongoExampleUri, worldNewsApiKey } = use(ConfigStack);

    const fetchingCron = new Cron(stack, "NewsFetchCron", {
        schedule: "rate(12 hours)",
        job: {
            function: {
                handler: "packages/backend/src/news/fetch.handler",
                timeout: "15 minutes",
                bind: [mongoExampleUri, worldNewsApiKey],
                // Allow llm calls
                permissions: [
                    new PolicyStatement({
                        actions: ["bedrock:InvokeModel"],
                        resources: ["*"],
                    }),
                ],
            },
        },
    });

    stack.addOutputs({
        FetchingCronId: fetchingCron.id,
    });
}

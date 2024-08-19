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
    const { interactionQueue } = interactionsResources(ctx);
    const { reloadCampaignQueue } = campaignResources(ctx);
    newsResources(ctx);

    return { interactionQueue, reloadCampaignQueue };
}

/**
 * Define all of our interactions resources
 * @param stack
 */
function interactionsResources({ stack }: StackContext) {
    // todo: split queue in half? Like interaction validator queue then interaction processor queue?
    // todo: Move sensitive stuff here? like airdropper and stuff?
    // todo: Should some part of business stuff moved here also? Like content minting?

    const { airdropPrivateKey, interactionValidatorPrivateKey, alchemyApiKey } =
        use(ConfigStack);
    // Interaction handling stuff
    const interactionQueue = new Queue(stack, "InteractionQueue", {
        consumer: {
            function: {
                handler: "packages/backend/src/interaction/queue.handler",
                timeout: "15 minutes",
                bind: [
                    airdropPrivateKey,
                    interactionValidatorPrivateKey,
                    alchemyApiKey,
                ],
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
        cdk: {
            queue: {
                visibilityTimeout: Duration.minutes(60),
            },
        },
    });
    stack.addOutputs({
        InteractionQueueId: interactionQueue.id,
    });
    return { interactionQueue };
}

/**
 * Define all of our campaign resources
 * @param stack
 */
function campaignResources({ stack }: StackContext) {
    const { airdropPrivateKey, alchemyApiKey, nexusRpcSecret } =
        use(ConfigStack);
    // Interaction handling stuff
    const reloadCampaignQueue = new Queue(stack, "ReloadCampaignQueue", {
        consumer: {
            function: {
                handler: "packages/backend/src/campaign/reloadQueue.handler",
                timeout: "15 minutes",
                bind: [airdropPrivateKey, alchemyApiKey, nexusRpcSecret],
            },
            cdk: {
                eventSource: {
                    // Maximum amount of item sent to the function (at most 200 interactions)
                    batchSize: 200,
                    // Wait at most 2min to push the interactions
                    maxBatchingWindow: Duration.seconds(5),
                    // Don't allow more than 4 parallel executions
                    maxConcurrency: 4,
                },
            },
        },
        cdk: {
            queue: {
                visibilityTimeout: Duration.minutes(60),
            },
        },
    });
    stack.addOutputs({
        ReloadCampaignQueueId: reloadCampaignQueue.id,
    });
    return { reloadCampaignQueue };
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

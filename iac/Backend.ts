import { isRunningInProd } from "@frak-labs/shared/context/utils/env";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Secret as AwsSecret } from "aws-cdk-lib/aws-secretsmanager";
import type { StackContext } from "sst/constructs";
import {
    Config,
    Cron,
    Queue,
    Function as SstFunction,
    use,
} from "sst/constructs";
import { ConfigStack } from "./Config";

/**
 * Define backend stack
 * @param ctx
 * @constructor
 */
export function BackendStack(ctx: StackContext) {
    const { interactionQueue, readPubKeyFunction } = interactionsResources(ctx);
    const { reloadCampaignQueue } = campaignResources(ctx);

    newsResources(ctx);

    return { interactionQueue, reloadCampaignQueue, readPubKeyFunction };
}

/**
 * Define all of our interactions resources
 *  todo: expose an api to get the signer public key for a given productId
 * @param stack
 */
function interactionsResources({ stack }: StackContext) {
    // Generate our master private key secret for product key derivation
    const masterKeySecret = new AwsSecret(stack, "MasterPrivateKey", {
        generateSecretString: {
            secretStringTemplate: JSON.stringify({ masterPrivateKey: "" }),
            generateStringKey: "masterPrivateKey",
            // Exclude letter not in the hex set
            excludeCharacters: "ghijklmnopqrstuvwxyz",
            excludeUppercase: true,
            excludePunctuation: true,
            includeSpace: false,
            passwordLength: 64,
        },
        description: "Master private key for product key derivation",
        removalPolicy: RemovalPolicy.RETAIN,
    });

    // Create a new config parameter to store the secret ARN
    const masterSecretId = new Config.Parameter(stack, "MASTER_KEY_SECRET_ID", {
        value: masterKeySecret.secretFullArn ?? masterKeySecret.secretArn,
    });

    const { alchemyApiKey } = use(ConfigStack);
    const interactionConsumerFunction = new SstFunction(
        stack,
        "InteractionQueueConsumer",
        {
            handler: "packages/backend/src/interaction/queue.handler",
            timeout: "15 minutes",
            bind: [masterSecretId, alchemyApiKey],
            permissions: [
                new PolicyStatement({
                    actions: ["secretsmanager:GetSecretValue"],
                    resources: [masterKeySecret.secretArn],
                }),
            ],
        }
    );

    // Interaction handling stuff
    const interactionQueue = new Queue(stack, "InteractionQueue", {
        consumer: {
            function: interactionConsumerFunction,
            cdk: {
                eventSource: {
                    // Maximum amount of item sent to the function (at most 200 interactions)
                    batchSize: 200,
                    // Wait at most 2min to push the interactions
                    maxBatchingWindow: isRunningInProd
                        ? Duration.minutes(2)
                        : Duration.seconds(10),
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

    const readPubKeyFunction = new SstFunction(stack, "ReadPubKeyFunction", {
        handler: "packages/backend/src/interaction/readPubKey.handler",
        timeout: "30 seconds",
        bind: [masterSecretId],
        permissions: [
            new PolicyStatement({
                actions: ["secretsmanager:GetSecretValue"],
                resources: [masterKeySecret.secretArn],
            }),
        ],
    });

    // Grant the read access on this secret for the consumer function
    masterKeySecret.grantRead(interactionConsumerFunction);

    stack.addOutputs({
        InteractionQueueId: interactionQueue.id,
        ReadPubKeyFunctionId: readPubKeyFunction.id,
    });
    return { interactionQueue, readPubKeyFunction };
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

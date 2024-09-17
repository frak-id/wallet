import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { Port } from "aws-cdk-lib/aws-ec2";
import {
    ApplicationProtocol,
    ApplicationTargetGroup,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Secret as AwsSecret } from "aws-cdk-lib/aws-secretsmanager";
import {
    Config,
    Queue,
    Service,
    Function as SstFunction,
    type StackContext,
    use,
} from "sst/constructs";
import { ConfigStack } from "./Config";
import { buildEcsService } from "./builder/ServiceBuilder";
import { isProdStack } from "./utils";

/**
 * Define backend stack
 * @param ctx
 * @constructor
 */
export function BackendStack(ctx: StackContext) {
    // Generate our master private key secret for product key derivation
    const masterKeySecret = new AwsSecret(ctx.stack, "MasterPrivateKey", {
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
    const masterSecretId = new Config.Parameter(
        ctx.stack,
        "MASTER_KEY_SECRET_ID",
        {
            value: masterKeySecret.secretFullArn ?? masterKeySecret.secretArn,
        }
    );

    const { interactionQueue } = interactionsResources(ctx, {
        masterKeySecret,
        masterSecretId,
    });

    // Add the elysia backend
    elysiaBackend(ctx, { masterKeySecret, masterSecretId });

    return {
        interactionQueue,
    };
}

/**
 * Define all of our interactions resources
 *  todo: expose an api to get the signer public key for a given productId
 * @param stack
 */
function interactionsResources(
    { stack }: StackContext,
    {
        masterKeySecret,
        masterSecretId,
    }: { masterKeySecret: AwsSecret; masterSecretId: Config.Parameter }
) {
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
                    maxBatchingWindow: isProdStack(stack)
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

    // Grant the read access on this secret for the consumer function
    masterKeySecret.grantRead(interactionConsumerFunction);

    stack.addOutputs({
        InteractionQueueId: interactionQueue.id,
    });
    return { interactionQueue };
}

/**
 * Create our elysia backend
 * @param stack
 */
function elysiaBackend(
    { stack }: StackContext,
    {
        masterKeySecret,
        masterSecretId,
    }: { masterKeySecret: AwsSecret; masterSecretId: Config.Parameter }
) {
    // Create a new ecs service that will host our elysia backend
    const services = buildEcsService({ stack });
    if (!services) {
        return;
    }
    const { vpc, cluster, alb } = services;

    // A few secrets we will be using
    const { mongoExampleUri, worldNewsApiKey, airdropPrivateKey } =
        use(ConfigStack);

    // The service itself
    const elysiaService = new Service(stack, "ElysiaService", {
        path: "packages/backend-elysia",
        port: 3030,
        // Setup some capacity options
        scaling: {
            minContainers: 1,
            maxContainers: 5,
            cpuUtilization: 80,
            memoryUtilization: 80,
        },
        // Bind the secret we will be using
        bind: [
            mongoExampleUri,
            worldNewsApiKey,
            airdropPrivateKey,
            masterSecretId,
        ],
        // Allow llm calls (used for the news-example part)
        permissions: [
            new PolicyStatement({
                actions: ["bedrock:InvokeModel"],
                resources: ["*"],
            }),
            new PolicyStatement({
                actions: ["secretsmanager:GetSecretValue"],
                resources: [masterKeySecret.secretArn],
            }),
        ],
        // Arm architecture (lower cost)
        architecture: "arm64",
        // Hardware config
        cpu: "0.25 vCPU",
        memory: "0.5 GB",
        storage: "20 GB",
        // Log retention
        logRetention: "three_days",
        cdk: {
            vpc,
            cluster,
            // Don't auto setup the ALB since we will be using the global one
            applicationLoadBalancer: false,
            // Customise fargate service to enable circuit breaker (if the new deployment is failing)
            fargateService: {
                enableExecuteCommand: true,
                circuitBreaker: {
                    enable: true,
                },
            },
        },
    });

    // Ensure we got a fargate service set up
    if (!elysiaService.cdk?.fargateService) {
        console.error(
            "No fargate service found for elysia service, skipping ALB setup"
        );
        return;
    }

    // Grant the read access on this secret for the consumer function
    masterKeySecret.grantRead(
        elysiaService.cdk.fargateService.taskDefinition.taskRole
    );

    // Create the target group for a potential alb usage
    const elysiaTargetGroup = new ApplicationTargetGroup(
        stack,
        "ElysiaTargetGroup",
        {
            vpc: vpc,
            port: 3030,
            protocol: ApplicationProtocol.HTTP,
            targets: [elysiaService.cdk.fargateService],
            deregistrationDelay: Duration.seconds(10),
            healthCheck: {
                path: "/",
                interval: Duration.seconds(30),
                healthyThresholdCount: 2,
                unhealthyThresholdCount: 5,
                healthyHttpCodes: "200",
            },
        }
    );

    // Allow connections to the applications ports
    alb.connections.allowTo(
        elysiaService.cdk.fargateService,
        Port.tcp(3030),
        "Allow connection from ALB to elysia"
    );

    // Create the listener on port 80
    alb.addListener("ElysiaListener", {
        port: 80,
        protocol: ApplicationProtocol.HTTP,
        defaultTargetGroups: [elysiaTargetGroup],
    });
}

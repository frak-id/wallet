import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Secret as AwsSecret } from "aws-cdk-lib/aws-secretsmanager";
import { Config, Service, type StackContext, use } from "sst/constructs";
import { ClusterStack } from "./Cluster";
import { ConfigStack } from "./Config";
import { isDevStack, isDistantStack } from "./utils";

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

    // Add the elysia backend
    elysiaBackend(ctx, { masterKeySecret, masterSecretId });
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
    if (!isDistantStack(stack)) {
        console.error("Services can only be used in distant stacks");
        return;
    }

    // Fetch VPC + cluster
    const { vpc, cluster } = use(ClusterStack);

    // A few secrets we will be using
    const {
        mongoExampleUri,
        worldNewsApiKey,
        indexerUrl,
        postgres,
        sessionEncryptionKey,
        vapidPrivateKey,
        vapidPublicKey,
        coinGeckoApiKey,
    } = use(ConfigStack);

    // The domain name we will be using
    const domainName = isDevStack(stack)
        ? "backend-dev.frak.id"
        : "backend.frak.id";

    // The service itself
    const elysiaService = new Service(stack, "ElysiaService", {
        path: "./",
        file: "iac/docker/ElysiaDockerfile",
        port: 3030,
        // Deployment domain
        customDomain: {
            domainName: domainName,
            hostedZone: "frak.id",
        },
        // Setup some capacity options
        scaling: {
            minContainers: 1,
            maxContainers: 5,
            cpuUtilization: 80,
            memoryUtilization: 80,
        },
        // Bind the secret we will be using
        bind: [
            // Some generic env
            indexerUrl,
            // some api keys
            mongoExampleUri,
            worldNewsApiKey,
            coinGeckoApiKey,
            // some secrets
            sessionEncryptionKey,
            masterSecretId,
            // postgres
            postgres.db,
            postgres.user,
            postgres.host,
            postgres.password,
            // notif secrets
            vapidPrivateKey,
            vapidPublicKey,
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
            // Customise fargate service to enable circuit breaker (if the new deployment is failing)
            fargateService: {
                enableExecuteCommand: true,
                circuitBreaker: {
                    enable: true,
                },
            },
            // Custom alb target group
            applicationLoadBalancerTargetGroup: {
                healthCheck: {
                    path: "/health",
                    interval: Duration.seconds(60),
                    healthyThresholdCount: 2,
                    unhealthyThresholdCount: 5,
                    healthyHttpCodes: "200",
                },
                deregistrationDelay: Duration.seconds(60),
            },
        },
    });

    elysiaService.addEnvironment("HOSTNAME", domainName);
    elysiaService.addEnvironment("STAGE", stack.stage);

    // Ensure we got a fargate service set up
    if (!elysiaService.cdk?.fargateService) {
        console.error(
            "No fargate service found for elysia service, skipping ALB setup"
        );
        return;
    }
}

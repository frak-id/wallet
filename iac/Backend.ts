import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { ContainerImage } from "aws-cdk-lib/aws-ecs";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Secret as AwsSecret } from "aws-cdk-lib/aws-secretsmanager";
import { Config, Service, type StackContext, use } from "sst/constructs";
import { ClusterStack } from "./Cluster";
import { ConfigStack } from "./Config";
import {
    extractEcsEnvFromConfigs,
    extractEcsSecretsFromConfigs,
    isDevStack,
    isDistantStack,
} from "./utils";

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
 * @param app
 * @param stack
 * @param masterKeySecret
 * @param masterSecretId
 */
function elysiaBackend(
    { app, stack }: StackContext,
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
        sessionEncryptionKey,
        jwtSecret,
        jwtSdkSecret,
        setupCodeSalt,
        mongoExampleUri,
        mongoNexusUri,
        alchemyApiKey,
        worldNewsApiKey,
        indexerUrl,
        postgres,
        vapidPrivateKey,
        vapidPublicKey,
        coinGeckoApiKey,
    } = use(ConfigStack);

    // Get the image that will be used for the backend
    // Get the container props of our prebuilt binaries
    const containerRegistry = Repository.fromRepositoryAttributes(
        stack,
        "ElysiaBackendRegistry",
        {
            repositoryArn: `arn:aws:ecr:eu-west-1:${app.account}:repository/${process.env.ELYSIA_REPO}`,
            repositoryName: process.env.ELYSIA_REPO ?? "",
        }
    );
    const dockerImage = ContainerImage.fromEcrRepository(
        containerRegistry,
        process.env.BACKEND_IMAGE_TAG ?? "latest"
    );

    // The domain name we will be using
    const domainName = isDevStack(stack)
        ? "backend-dev.frak.id"
        : "backend.frak.id";

    // Build our secrets map
    const secrets = extractEcsSecretsFromConfigs(stack, [
        // Db secrets
        postgres.host,
        postgres.password,
        mongoExampleUri,
        mongoNexusUri,
        // External api secrets
        alchemyApiKey,
        coinGeckoApiKey,
        worldNewsApiKey,
        // Internal secrets
        jwtSdkSecret,
        jwtSecret,
        sessionEncryptionKey,
        setupCodeSalt,
        // Notification secrets
        vapidPrivateKey,
        vapidPublicKey,
    ]);
    const envFromConfigs = extractEcsEnvFromConfigs([
        indexerUrl,
        postgres.db,
        postgres.user,
        masterSecretId,
    ]);

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
            // Start to scale when we handle more than 30k requests on each container
            requestsPerContainer: 30_000,
        },
        // Bind the secret we will be using
        bind: [
            // Some generic env
            indexerUrl,
            // some api keys
            worldNewsApiKey,
            coinGeckoApiKey,
            alchemyApiKey,
            // some secrets
            setupCodeSalt,
            sessionEncryptionKey,
            jwtSecret,
            jwtSdkSecret,
            masterSecretId,
            // mongo
            mongoExampleUri,
            mongoNexusUri,
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
        environment: envFromConfigs,
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
            // Directly specify the image position in the registry here
            container: {
                containerName: "elysia",
                image: dockerImage,
                portMappings: [{ containerPort: 3030 }],
                secrets,
                environment: {
                    ...envFromConfigs,
                    STAGE: app.stage,
                    SST_STAGE: app.stage,
                    SST_APP: app.name,
                    HOSTNAME: domainName,
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
}

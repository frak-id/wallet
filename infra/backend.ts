import * as aws from "@pulumi/aws";
import { Output } from "@pulumi/pulumi";
import { indexerUrl, isProd, vpc } from "./config";
import { SstService } from "./utils";

// Get the master cluster
export const cluster = await aws.ecs.getCluster({
    clusterName: `master-cluster-${$app.stage}`,
});

// Get the master secret key
const masterSecretKey = aws.secretsmanager.getSecret({
    name: isProd
        ? "MasterPrivateKeyFAAD0A05-L7zmByBQjYzr"
        : "MasterPrivateKeyFAAD0A05-0uIIzzLQMOET",
});

// Get the image we will deploy
const image = await aws.ecr.getImage({
    repositoryName: process.env.ELYSIA_REPO ?? "backend-elysia-dev",
    imageTag: process.env.BACKEND_IMAGE_TAG ?? "latest",
});

// The domain name we will be using
const _domainName = isProd ? "backend.frak.id" : "backend-dev.frak.id";

// Create the erpc service (only on prod stage)
export const backendService = new SstService("Elysia", {
    vpc,
    cluster: {
        name: cluster.clusterName,
        arn: cluster.arn,
    },
    // hardware config
    cpu: "0.25 vCPU",
    memory: "0.5 GB",
    storage: "20 GB",
    architecture: "arm64",
    // Image to be used
    image: image.imageUri,
    // Scaling options
    scaling: isProd
        ? {
              min: 1,
              max: 4,
              cpuUtilization: 80,
              memoryUtilization: 80,
          }
        : {
              min: 1,
              max: 1,
          },
    // Logging options
    logging: {
        retention: "3 days",
    },
    // Env
    environment: {
        STAGE: $app.stage,
        INDEXER_URL: indexerUrl,
        MASTER_KEY_SECRET_ID: Output.create(masterSecretKey).apply(
            (secretKey) => secretKey.arn
        ),
        POSTGRES_DB: isProd ? "backend" : "backend_dev",
        POSTGRES_USER: isProd ? "backend" : "backend-dev",
    },
    // Secrets from SSM
    ssm: {
        // DB's
        POSTGRES_HOST:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/POSTGRES_HOST/value",
        POSTGRES_PASSWORD: isProd
            ? "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/prod/Secret/POSTGRES_PASSWORD/value"
            : "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/POSTGRES_PASSWORD/value",
        MONGODB_EXAMPLE_URI:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/MONGODB_EXAMPLE_URI/value",
        MONGODB_NEXUS_URI:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/MONGODB_NEXUS_URI/value",
        // Sessions
        JWT_SECRET:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/JWT_SECRET/value",
        JWT_SDK_SECRET:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/JWT_SDK_SECRET/value",
        PRODUCT_SETUP_CODE_SALT:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/PRODUCT_SETUP_CODE_SALT/value",
        SESSION_ENCRYPTION_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/SESSION_ENCRYPTION_KEY/value",
        // Notifications
        VAPID_PUBLIC_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/VAPID_PUBLIC_KEY/value",
        VAPID_PRIVATE_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/VAPID_PRIVATE_KEY/value",
        // API key's
        ALCHEMY_API_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/ALCHEMY_API_KEY/value",
        PIMLICO_API_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/PIMLICO_API_KEY/value",
        COIN_GECKO_API_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/COIN_GECKO_API_KEY/value",
        WORLD_NEWS_API_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/WORLD_NEWS_API_KEY/value",
        NEXUS_RPC_SECRET:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/NEXUS_RPC_SECRET/value",
    },
});

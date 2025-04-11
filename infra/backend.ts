import * as aws from "@pulumi/aws";
import { Output, all } from "@pulumi/pulumi";
import { ServiceTargets } from "./components/ServiceTargets.ts";
import { erpcUrl, indexerUrl } from "./config";
import { isProd } from "./utils.ts";

// Create the elysia backend service (only on prod stage)
if (isProd) {
    // Get the VPC
    const vpcId = $output(
        aws.ec2.getVpc({
            filters: [{ name: "tag:Name", values: ["master-vpc"] }],
        })
    ).apply((vpc) => vpc.id);
    const vpc = sst.aws.Vpc.get("MasterVpc", vpcId);

    // Get the master cluster
    const clusterName = `master-cluster-${isProd ? "production" : "dev"}`;
    const sstCluster = sst.aws.Cluster.get("MasterCluster", {
        id: Output.create(aws.ecs.getCluster({ clusterName })).apply(
            (c) => c.id
        ),
        vpc: vpc,
    });

    // Get the master secret key
    const masterSecretKey = aws.secretsmanager.getSecret({
        name: isProd ? "MasterPrivateKey-Prod" : "MasterPrivateKey-Dev",
    });

    // Get the image we will deploy
    const image = await aws.ecr.getImage({
        repositoryName: process.env.ELYSIA_REPO ?? "backend-elysia-dev",
        imageTag: process.env.BACKEND_IMAGE_TAG ?? "latest",
    });

    // The domain name we will be using
    const domainName = isProd ? "backend.frak.id" : "backend-dev.frak.id";

    /**
     * All the ssm secrets we will load into the service
     */
    const ssmSecrets = {
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
        DRPC_API_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/DRPC_API_KEY/value",
        PIMLICO_API_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/PIMLICO_API_KEY/value",
        COIN_GECKO_API_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/COIN_GECKO_API_KEY/value",
        WORLD_NEWS_API_KEY:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/WORLD_NEWS_API_KEY/value",
        NEXUS_RPC_SECRET:
            "arn:aws:ssm:eu-west-1:262732185023:parameter/sst/wallet/.fallback/Secret/NEXUS_RPC_SECRET/value",
    };

    // On dev environment, map the ssm secrets do new environment variables
    const devEnv = $dev
        ? Object.fromEntries(
              Object.entries(ssmSecrets).map(([key, value]) => {
                  // Get the SSM secrets, decrypt it, and return it's value
                  const secret = Output.create(
                      aws.ssm.getParameter({
                          name: value,
                      })
                  ).apply((secret) => secret.value);

                  // Return the key and the secret
                  return [key, secret];
              })
          )
        : {};

    // The full environment config for the backend
    const fullEnv = {
        ...devEnv,
        STAGE: $app.stage,
        INDEXER_URL: indexerUrl,
        MASTER_KEY_SECRET_ID: Output.create(masterSecretKey).apply(
            (secretKey) => secretKey.arn
        ),
        POSTGRES_DB: isProd ? "backend" : "backend_dev",
        POSTGRES_USER: isProd ? "backend" : "backend-dev",
        // todo: should be direct kubernetes serve + namespace once on gcp
        ERPC_URL: erpcUrl,
        HOSTNAME: $dev ? "" : domainName,
    };
    // Create the service targets
    const backendServiceTargets = new ServiceTargets("BackendServiceDomain", {
        vpcId: vpc.id,
        domain: domainName,
        ports: [
            { listen: "80/http", forward: "3030/http" },
            { listen: "443/https", forward: "3030/http" },
        ],
        health: {
            path: "/health",
            interval: "60 seconds",
            timeout: "5 seconds",
            successCodes: "200",
            healthyThreshold: 2,
            unhealthyThreshold: 5,
        },
    });

    new sst.aws.Service("Elysia", {
        cluster: sstCluster,
        // Development configuration
        //  todo: Find a way to link SSM parameters to the dev env
        // dev: {
        //     autostart: true,
        //     directory: "packages/backend-elysia",
        //     command: "bun run dev",
        // },
        // hardware config
        cpu: "0.5 vCPU",
        memory: "1 GB",
        storage: "20 GB",
        architecture: "arm64",
        // Image to be used
        image: image.imageUri,
        // Scaling options
        scaling: {
            min: 1,
            max: 4,
            cpuUtilization: 80,
            memoryUtilization: 80,
        },
        // Logging options
        logging: {
            retention: "3 days",
        },
        // Env
        environment: fullEnv,
        // Secrets from SSM
        ssm: ssmSecrets,
        // Some custom permissions
        permissions: [
            {
                actions: ["ssm:GetParameter"],
                resources: ["*"],
            },
            {
                actions: ["bedrock:InvokeModel"],
                resources: ["*"],
            },
            {
                actions: ["secretsmanager:GetSecretValue"],
                resources: [masterSecretKey.then((key) => key.arn)],
            },
        ],
        // Link the service to the ELB
        transform: {
            service: {
                loadBalancers: all(backendServiceTargets.targetGroups).apply(
                    (target) =>
                        Object.values(target).map((target) => ({
                            targetGroupArn: target.arn,
                            containerName: "Elysia",
                            containerPort: target.port.apply(
                                (port) => port as number
                            ),
                        }))
                ),
            },
        },
    });
}

import { readFileSync } from "node:fs";
import path from "node:path";
import type { Input, Resource } from "@pulumi/pulumi";
import { KubernetesService } from "../components/KubernetesService";
import {
    backendUrl,
    businessUrl,
    componentsUrl,
    nexusRpcSecret,
    productSetupCodeSalt,
    publicBackendUrl,
    shopifyApiKey,
    shopifyApiSecret,
    shopifyAppUrl,
    walletUrl,
} from "../config";
import { isProd, normalizedStageName } from "../utils";
import { shopifyPostgresEnv } from "./secrets";
import {
    baseDomainName,
    cachedImage,
    dbTunnelLocalPort,
    getRegistryPath,
    walletNamespace,
} from "./utils";

const subDomain = isProd ? "extension-shop" : "extension-shop-dev";

/**
 * Access scopes for the embedded app, read from the same TOML the Shopify CLI
 * deploys (`shopify app deploy --config <stage>`), so the granted scopes and
 * the ones `shopifyApp` requests can never drift apart.
 *
 * Required at RUNTIME: `shopify.server.ts` reads `process.env.SCOPES`, and with
 * it unset `shopifyApp` cannot compare granted vs. required scopes — token
 * exchange then fails and every embedded request 401s. Throw rather than
 * deploy a pod that authenticates nothing.
 */
const shopifyScopes = readShopifyScopes();

function readShopifyScopes(): string {
    const configFile = isProd
        ? "shopify.app.production.toml"
        : "shopify.app.development.toml";
    const location = path.join($cli.paths.root, "apps/shopify", configFile);
    const scopes = readFileSync(location, "utf8")
        .split(/^\[/m)
        .find((section) => section.startsWith("access_scopes]"))
        ?.match(/^scopes\s*=\s*"([^"]*)"/m)?.[1]
        ?.trim();

    if (!scopes) {
        throw new Error(
            `[shopify] no non-empty \`scopes\` under [access_scopes] in ${configFile}`
        );
    }
    return scopes;
}

/**
 * Target Postgres = the in-cluster GCP instance, dedicated `shopify` database +
 * `shopify_<stage>` role (isolated from the backend credentials; read from
 * Secret Manager in ./secrets). Mapped into the app's existing env var names
 * (db.server.ts is unchanged).
 */
const targetDbEnv = {
    SHOPIFY_POSTGRES_HOST: shopifyPostgresEnv.POSTGRES_HOST,
    POSTGRES_SHOPIFY_DB: shopifyPostgresEnv.POSTGRES_DB,
    POSTGRES_USER: shopifyPostgresEnv.POSTGRES_USER,
    SHOPIFY_POSTGRES_PASSWORD: shopifyPostgresEnv.POSTGRES_PASSWORD,
};

/**
 * Public, non-secret vars. Inlined into the JS bundle at BUILD time by Vite
 * `define` (apps/shopify/vite.config.ts) — passed as Docker build args.
 */
const shopifyBuildEnv = {
    NODE_ENV: "production",
    STAGE: normalizedStageName,
    FRAK_WALLET_URL: walletUrl,
    FRAK_COMPONENTS_URL: componentsUrl,
    BUSINESS_URL: businessUrl,
    BACKEND_URL: backendUrl,
    PUBLIC_BACKEND_URL: publicBackendUrl,
    SHOPIFY_API_KEY: shopifyApiKey,
    SHOPIFY_APP_URL: shopifyAppUrl,
};

/**
 * Secrets read from `process.env` at RUNTIME by the server (db.server.ts,
 * shopify.server.ts, services). Injected into the pod via a Kubernetes Secret.
 */
const shopifyRuntimeEnv = {
    STAGE: normalizedStageName,
    SHOPIFY_APP_URL: shopifyAppUrl,
    SCOPES: shopifyScopes,
    ...targetDbEnv,
    SHOPIFY_API_SECRET: shopifyApiSecret.value,
    PRODUCT_SETUP_CODE_SALT: productSetupCodeSalt.value,
    NEXUS_RPC_SECRET: nexusRpcSecret.value,
};

/**
 * Local-dev runtime env. Same shared master Postgres, but reached through the
 * GCP tunnel (infra/gcp/dev.ts `db-tunnel`) at localhost:<tunnel port> instead
 * of the in-cluster private IP — mirrors the wallet backend's dev DB setup.
 * The shopify DB name/role/password still select the dedicated `shopify` DB.
 */
const shopifyDevRuntimeEnv = {
    ...shopifyRuntimeEnv,
    SHOPIFY_POSTGRES_HOST: "localhost",
    SHOPIFY_POSTGRES_PORT: dbTunnelLocalPort,
    // Local BACKEND_URL is https://localhost:3030 with a mkcert cert. Node's
    // fetch ignores the OS trust store by default, so let it read the mkcert
    // root CA already installed in the system keychain.
    NODE_OPTIONS: "--use-system-ca",
};

const appLabels = { app: "shopify-frontend" };

// Everything below (DB, image, secrets) is real infra and must NOT be created
// under `sst dev` — only the KubernetesService is created there, and it
// self-guards down to a DevCommand. Mirrors infra/gcp/business.ts.
let shopifyImage = $output("");
let runtimeSecretName: Input<string> | undefined;
const serviceDeps: Resource[] = [];

if (!$dev) {
    // The `shopify` database + `shopify_<stage>` role + `shopify-db-secret-<stage>`
    // Secret Manager entry are provisioned out-of-band by the DB team (same as the
    // backend's wallet-backend DB/role/secret). The role must own the database /
    // have CREATE on `public`.

    // Runtime SSR image
    const image = cachedImage("shopify", {
        context: { location: $cli.paths.root },
        dockerfile: {
            location: path.join($cli.paths.root, "apps/shopify/Dockerfile"),
        },
        // All build args are public (baked by Vite define). No build secrets.
        buildArgs: shopifyBuildEnv,
        platforms: ["linux/amd64"],
        push: true,
        tags: getRegistryPath("shopify"),
    });
    shopifyImage = image.ref;

    // ---- Runtime secret ---------------------------------------------------
    const shopifySecrets = new kubernetes.core.v1.Secret("shopify-secrets", {
        metadata: {
            name: `shopify-secrets-${normalizedStageName}`,
            namespace: walletNamespace.metadata.name,
        },
        type: "Opaque",
        stringData: shopifyRuntimeEnv,
    });
    runtimeSecretName = shopifySecrets.metadata.name;

    serviceDeps.push(image, shopifySecrets);
}

/**
 * Shopify embedded app — React Router v7 SSR server on Kubernetes.
 * Replaces the previous `sst.aws.React` (Lambda + CloudFront) deployment and
 * points at the in-cluster GCP Postgres.
 */
export const shopifyService = new KubernetesService(
    "shopify",
    {
        namespace: walletNamespace.metadata.name,
        appLabels,

        // Dev command (runs when `sst dev` is active) — mirrors the old
        // `bun run shopify:dev` flow (Shopify CLI tunnel).
        dev: {
            dev: {
                command: "bun run shopify:dev",
                directory: "apps/shopify",
                autostart: false,
            },
            environment: { ...shopifyBuildEnv, ...shopifyDevRuntimeEnv },
        },

        // Pod config
        pod: {
            containers: [
                {
                    name: "shopify",
                    image: shopifyImage,
                    ports: [{ containerPort: 3000, name: "http" }],
                    env: [{ name: "PORT", value: "3000" }],
                    envFrom: runtimeSecretName
                        ? [{ secretRef: { name: runtimeSecretName } }]
                        : undefined,
                    livenessProbe: {
                        httpGet: { path: "/health", port: 3000 },
                        initialDelaySeconds: 15,
                        periodSeconds: 10,
                        timeoutSeconds: 5,
                        failureThreshold: 3,
                    },
                    readinessProbe: {
                        httpGet: { path: "/health", port: 3000 },
                        initialDelaySeconds: 5,
                        periodSeconds: 10,
                        timeoutSeconds: 3,
                        failureThreshold: 2,
                    },
                    resources: {
                        requests: {
                            cpu: isProd ? "100m" : "50m",
                            memory: "256Mi",
                        },
                        limits: { cpu: "400m", memory: "512Mi" },
                    },
                },
            ],
        },

        // Service config (ingress :80 -> container :3000)
        service: {
            ports: [
                { port: 80, targetPort: 3000, protocol: "TCP", name: "http" },
            ],
        },

        // HPA config
        hpa: {
            min: 1,
            max: isProd ? 3 : 2,
            cpuUtilization: 120,
        },

        // Ingress config
        //
        // Two-phase cutover from the legacy AWS (CloudFront) deployment. Both
        // hosts share ONE cert (single tlsSecretName -> one Certificate with
        // every host as a SAN), and the cluster-issuer validates via HTTP-01.
        // cert-manager only issues that cert once EVERY SAN passes its
        // challenge, so the canonical `${subDomain}.frak.id` host cannot be
        // added until its DNS points at this ingress (otherwise the whole cert
        // — including the cluster subdomain below — stays pending).
        //
        // Phase 1 (this release): serve + validate only on the cluster
        // subdomain `${subDomain}.${baseDomainName}`, which already resolves to
        // the nginx ingress LB. The HTTP-01 challenge passes immediately and
        // the app can be verified end-to-end over HTTPS while the legacy AWS
        // app keeps serving `${subDomain}.frak.id`.
        //
        // Phase 2 (after validation): repoint `${subDomain}.frak.id` DNS from
        // CloudFront to this ingress LB, then uncomment `additionalHosts`
        // below and redeploy so cert-manager can complete the apex SAN
        // challenge. Tear down the legacy AWS Shopify stack LAST (removing it
        // also deletes the Route53 record it owns — repoint DNS deliberately
        // rather than relying on that removal).
        ingress: {
            host: `${subDomain}.${baseDomainName}`,
            tlsSecretName: "shopify-tls",
            // Phase 2: uncomment once `${subDomain}.frak.id` DNS points here.
            additionalHosts: [`${subDomain}.frak.id`],
        },
    },
    {
        dependsOn: serviceDeps,
    }
);

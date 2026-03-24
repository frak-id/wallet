import type { Output } from "@pulumi/pulumi";
import { isProd, normalizedStageName } from "../utils";

// Base domain: v2.gcp.frak.id or v2.gcp-dev.frak.id for V2, gcp.frak.id or gcp-dev.frak.id for V1
export const baseDomainName = isProd ? "gcp.frak.id" : "gcp-dev.frak.id";

export const domainName = `backend.${baseDomainName}`;

// Create a dedicated namespace for the wallet
export const walletNamespace = new kubernetes.core.v1.Namespace(
    "infra-wallet",
    {
        metadata: { name: `wallet-${normalizedStageName}` },
    }
);

const imageRetentionPeriod = isProd ? "30d" : "7d";

let registryPath: Output<string> | undefined;
if (!$dev) {
    const registry = new gcp.artifactregistry.Repository("wallet-gcr", {
        repositoryId: `wallet-${normalizedStageName}`,
        format: "DOCKER",
        description: "Artifact registry for the wallet images",
        location: "europe-west1",
        project: gcp.config.project,
        cleanupPolicyDryRun: false,
        cleanupPolicies: [
            {
                id: "keep-recent-versions",
                action: "KEEP",
                mostRecentVersions: {
                    keepCount: 5,
                },
            },
            {
                id: "delete-old-commit-tags",
                action: "DELETE",
                condition: {
                    tagState: "TAGGED",
                    tagPrefixes: ["git-", "local-"],
                    olderThan: imageRetentionPeriod,
                },
            },
            {
                id: "delete-untagged",
                action: "DELETE",
                condition: {
                    tagState: "UNTAGGED",
                    olderThan: "1d",
                },
            },
        ],
    });
    registryPath = registry.location.apply(
        (location) =>
            `${location}-docker.pkg.dev/${gcp.config.project}/wallet-${normalizedStageName}`
    );
}

export function getRegistryPath(image: string) {
    if ($dev) {
        return [`wallet-${image}`];
    }
    return (
        registryPath?.apply((path) => [
            `${path}/${image}:${process.env.COMMIT_HASH ? `git-${process.env.COMMIT_HASH}` : "local-build"}`,
            `${path}/${image}:latest`,
        ]) ?? []
    );
}

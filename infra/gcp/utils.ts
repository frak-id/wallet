import type { Output } from "@pulumi/pulumi";
import { isProd, isV2, normalizedStageName } from "../utils";

// Base domain: v2.gcp.frak.id or v2.gcp-dev.frak.id for V2, gcp.frak.id or gcp-dev.frak.id for V1
const baseGcpDomain = isProd ? "gcp.frak.id" : "gcp-dev.frak.id";
export const baseDomainName = isV2 ? `v2.${baseGcpDomain}` : baseGcpDomain;

export const domainName = `backend.${baseDomainName}`;

// Create a dedicated namespace for the wallet
export const walletNamespace = new kubernetes.core.v1.Namespace(
    "infra-wallet",
    {
        metadata: { name: `wallet-${normalizedStageName}${isV2 ? "-v2" : ""}` },
    }
);

let registryPath: Output<string> | undefined;
if (!$dev) {
    const registry = new gcp.artifactregistry.Repository("wallet-gcr", {
        repositoryId: `wallet-${normalizedStageName}${isV2 ? "-v2" : ""}`,
        format: "DOCKER",
        description: "Artifact registry for the cooking bot images",
        location: "europe-west1",
        project: gcp.config.project,
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

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

/**
 * In-cluster zot registry, reachable in plain HTTP. The buildkit daemon already
 * trusts this hostname via its buildkitd.toml (registry."..." with http = true),
 * so no insecure flag is required at the build-invocation level.
 */
const ZOT_HOST = "zot.zot.svc.cluster.local:5000";

/**
 * Sanitize the current git ref into a valid OCI tag (alnum, dot, dash, underscore,
 * lowercase, length-capped). Falls back to `dev` when unset so local SST runs still
 * resolve to a sensible cache namespace.
 */
const sanitizedBranch = (process.env.GITHUB_REF_NAME ?? "dev")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase()
    .slice(0, 100);

type CachedImageArgs = dockerbuild.ImageArgs & {
    /**
     * Override the zot cache repository. Defaults to `cache/<image-name>` which
     * gives each image its own namespace (no write contention between parallel
     * builds, while blob-level dedup in zot still recovers shared layer storage).
     */
    cacheRepo?: string;
};

/**
 * Wrap `dockerbuild.Image` with import/export cache pointing at the in-cluster zot.
 *
 * Cache key strategy:
 *   - Per-image repo (`cache/<name>`) avoids manifest write contention between
 *     concurrent builds and keeps retention policies trivially scoped.
 *   - `cacheTo` writes to the current branch tag — long-lived branches accumulate
 *     their own warm cache.
 *   - `cacheFrom` falls back to `branch-dev` then `branch-main` so cold PR builds
 *     pick up the freshest available baseline.
 *
 * `mode: "max"` exports every intermediate layer (not just the final image) which
 * is what lets multi-stage Dockerfiles actually benefit from registry cache.
 * `imageManifest` + `ociMediaTypes` produce OCI-native manifests, matching zot's
 * preferred flavor and avoiding the occasional Docker-schema cache-miss footgun.
 */
export function cachedImage(
    name: string,
    args: CachedImageArgs
): dockerbuild.Image {
    const repo = args.cacheRepo ?? `cache/${name}`;
    const cacheRef = (tag: string) => `${ZOT_HOST}/${repo}:${tag}`;

    return new dockerbuild.Image(name, {
        ...args,
        cacheFrom: [
            { registry: { ref: cacheRef(`branch-${sanitizedBranch}`) } },
            { registry: { ref: cacheRef("branch-dev") } },
            { registry: { ref: cacheRef("branch-main") } },
            ...(args.cacheFrom ?? []),
        ],
        cacheTo: [
            {
                registry: {
                    ref: cacheRef(`branch-${sanitizedBranch}`),
                    mode: "max",
                    imageManifest: true,
                    ociMediaTypes: true,
                },
            },
            ...(args.cacheTo ?? []),
        ],
    });
}

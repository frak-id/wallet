import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * `sdk[-dev].frak.id/components.js`: a 5-minute-TTL pointer at the exact
 * jsDelivr release, deployed by the release workflows right after `npm publish`.
 * `/loader.js` redirects to the same release so integrations can modulepreload it.
 * Also the production origin of the Shopify ambassador app proxy page.
 */

const POINTER_STAGES = {
    "sdk-pointer": { domain: "sdk.frak.id" },
    "sdk-pointer-dev": { domain: "sdk-dev.frak.id" },
} as const;

type PointerStage = keyof typeof POINTER_STAGES;

export function isSdkPointerStage(stage: string): stage is PointerStage {
    return stage in POINTER_STAGES;
}

const stage = $app.stage;
if (!isSdkPointerStage(stage)) {
    throw new Error(
        `SDK pointer stages are ${Object.keys(POINTER_STAGES).join(", ")}, got "${stage}"`
    );
}

// No stale-while-revalidate on purpose: past 5 min the browser revalidates
// (one 304 round trip, usually hidden behind parsing since the script is
// deferred) so every browser is on the new version by the next page load.
const CACHE_CONTROL = "public, max-age=300, stale-if-error=604800";
const SHIM_KEY = "components.js";
const AMBASSADOR_KEY = "shopify/ambassador";

// `SDK_POINTER_VERSION` pins any published version by hand (rollback, hotfix);
// otherwise the pointer follows the version the release just published.
const version =
    process.env.SDK_POINTER_VERSION ||
    (
        JSON.parse(
            readFileSync(
                path.join($cli.paths.root, "sdk/components/package.json"),
                "utf8"
            )
        ) as { version: string }
    ).version;

const loaderUrl = `https://cdn.jsdelivr.net/npm/@frak-labs/components@${version}/cdn/loader.js`;

// Same statement `sdk/components/src/components.ts` builds to for this version.
const shim = `import("${loaderUrl}");\n`;

// The bucket route never forwards Origin, so S3 CORS cannot answer;
// `<script type="module">` integrations and the modulepreload need these from the edge.
const edgeHeaders = Object.entries({
    "access-control-allow-origin": "*",
    "cross-origin-resource-policy": "cross-origin",
    "timing-allow-origin": "*",
    "x-content-type-options": "nosniff",
});
const cfHeaders = (headers: [string, string][]) =>
    `{ ${headers.map(([k, v]) => `"${k}": { value: "${v}" }`).join(", ")} }`;

const bucket = new sst.aws.Bucket("SdkPointer", {
    access: "cloudfront",
    versioning: true,
});

const shimObject = new aws.s3.BucketObjectv2("SdkPointerShim", {
    bucket: bucket.name,
    key: SHIM_KEY,
    content: shim,
    contentType: "text/javascript; charset=utf-8",
    cacheControl: CACHE_CONTROL,
});

const ambassadorPage = readFileSync(
    path.join($cli.paths.root, "apps/shopify/proxy/ambassador.liquid"),
    "utf8"
);

// Shopify renders the body inside the shop's theme only for this content type.
const ambassadorObject = new aws.s3.BucketObjectv2("SdkPointerAmbassador", {
    bucket: bucket.name,
    key: AMBASSADOR_KEY,
    content: ambassadorPage,
    contentType: "application/liquid",
    cacheControl: CACHE_CONTROL,
});

const router = new sst.aws.Router("SdkPointerRouter", {
    domain: POINTER_STAGES[stage].domain,
    // Bucket routes take no per-route `edge`; the Router-level function runs on
    // the default behavior, which is the only one this Router has.
    edge: {
        // Runs before route matching. Shopify forwards child paths and appends a
        // per-request timestamp + signature, which would make every request a miss.
        viewerRequest: {
            // The module map is keyed by the requested URL and the base URL is the
            // final one, so the preload lands in the HTTP cache the shim's import()
            // reads, and loader.js's relative chunks still resolve on jsDelivr.
            injection: `
if (event.request.uri === "/loader.js") {
    return {
        statusCode: 302,
        statusDescription: "Found",
        headers: ${cfHeaders([["location", loaderUrl], ["cache-control", CACHE_CONTROL], ...edgeHeaders])},
    };
}
if (event.request.uri.startsWith("/${AMBASSADOR_KEY}")) {
    event.request.uri = "/${AMBASSADOR_KEY}";
    event.request.querystring = {};
}
`,
        },
        viewerResponse: {
            injection: edgeHeaders
                .map(
                    ([k, v]) =>
                        `event.response.headers["${k}"] = { value: "${v}" };`
                )
                .join("\n"),
        },
    },
});

router.routeBucket("/", bucket);

// `Router.invalidation` is declared but not implemented in SST 4.14.3, so the
// edge is purged with the AWS CLI; a new version re-triggers the command.
new command.local.Command(
    "SdkPointerInvalidation",
    {
        create: $interpolate`id=$(aws cloudfront create-invalidation --distribution-id ${router.distributionID} --paths /${SHIM_KEY} --query Invalidation.Id --output text) && aws cloudfront wait invalidation-completed --distribution-id ${router.distributionID} --id "$id"`,
        triggers: [version],
    },
    { dependsOn: [shimObject] }
);

new command.local.Command(
    "SdkPointerAmbassadorInvalidation",
    {
        create: $interpolate`id=$(aws cloudfront create-invalidation --distribution-id ${router.distributionID} --paths "/${AMBASSADOR_KEY}*" --query Invalidation.Id --output text) && aws cloudfront wait invalidation-completed --distribution-id ${router.distributionID} --id "$id"`,
        triggers: [createHash("sha256").update(ambassadorPage).digest("hex")],
    },
    { dependsOn: [ambassadorObject] }
);

export const sdkPointerUrl = $interpolate`${router.url}/${SHIM_KEY}`;
export const sdkPointerVersion = version;

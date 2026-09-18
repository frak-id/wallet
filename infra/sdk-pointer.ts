import {
    isPointerStage,
    SDK_POINTER_CACHE_CONTROL,
    SDK_POINTER_SHIM_KEY,
    sdkPointerAlias,
    sdkPointerBucketName,
    sdkPointerSeedContent,
} from "./sdk-pointer.shared";

const stage = $app.stage;
if (!isPointerStage(stage)) {
    throw new Error(
        `SDK pointer is provisioned for the "prod" and "dev" stages only, got "${stage}"`
    );
}

/**
 * Deterministic physical name: the release workflow's `aws s3 cp` targets
 * this bucket by name, with no SST state access.
 */
export const sdkPointerBucket = new sst.aws.Bucket("SdkPointer", {
    access: "cloudfront",
    versioning: true,
    transform: {
        bucket: {
            bucket: sdkPointerBucketName(stage),
        },
    },
});

export const sdkPointerRouter = new sst.aws.Router("SdkPointerRouter", {
    domain: sdkPointerAlias(stage),
    // Bucket routes take no per-route `edge`; the Router-level functions run on
    // the default behavior, which is the only one this Router has.
    edge: {
        viewerResponse: {
            // CloudFront's bucket route uses the CachingOptimized policy and
            // never forwards Origin, so S3 CORS headers can't apply here —
            // module scripts need these at the edge instead.
            injection: `
event.response.headers["access-control-allow-origin"] = { value: "*" };
event.response.headers["cross-origin-resource-policy"] = { value: "cross-origin" };
event.response.headers["timing-allow-origin"] = { value: "*" };
event.response.headers["x-content-type-options"] = { value: "nosniff" };
`,
        },
    },
});

sdkPointerRouter.routeBucket("/", sdkPointerBucket);

/**
 * Seeded once so the pointer URL is never a 404 between the first `sst
 * deploy` and the first release. `ignoreChanges` keeps every later deploy
 * from clobbering what the release workflow uploaded.
 */
new aws.s3.BucketObjectv2(
    "SdkPointerSeed",
    {
        bucket: sdkPointerBucket.name,
        key: SDK_POINTER_SHIM_KEY,
        content: sdkPointerSeedContent(stage),
        contentType: "text/javascript; charset=utf-8",
        cacheControl: SDK_POINTER_CACHE_CONTROL,
    },
    {
        ignoreChanges: [
            "content",
            "source",
            "etag",
            "contentBase64",
            "metadata",
            "cacheControl",
            "contentType",
        ],
    }
);

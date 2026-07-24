import {
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import {
    DOWNSCALE_VARIANTS,
    resizeToVariant,
    resolveImageType,
    SIZE_SUFFIX_PATTERN,
} from "../../backend/src/domain/media/services/imageVariants";

const BUCKET_REGION = "europe-west1";

type BackfillStats = {
    objectsScanned: number;
    variantsCreated: number;
    skippedExisting: number;
    failures: number;
};

/**
 * Backfills the `-md`/`-sm` WebP downscales for existing merchant media that
 * only has the canonical (`lg`) object. Never touches the canonical object.
 *
 * Idempotent: a target `-{size}.webp` key is skipped (via HeadObjectCommand)
 * if it already exists, so re-running only fills in gaps.
 */
export async function runImageVariantBackfill(): Promise<void> {
    const endpoint = process.env.RUSTFS_ENDPOINT;
    if (!endpoint) {
        console.log("[bootstrap:media] RUSTFS_ENDPOINT not set, skipping");
        return;
    }

    const stage = process.env.STAGE ?? "dev";
    const bucket = `images-${stage}`;

    console.log(
        `[bootstrap:media] Scanning bucket ${bucket} on ${endpoint} for missing size variants`
    );

    const client = new S3Client({
        endpoint,
        region: BUCKET_REGION,
        forcePathStyle: true,
        credentials: {
            accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? "",
            secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? "",
        },
    });

    const stats: BackfillStats = {
        objectsScanned: 0,
        variantsCreated: 0,
        skippedExisting: 0,
        failures: 0,
    };

    let continuationToken: string | undefined;
    do {
        const page = await client.send(
            new ListObjectsV2Command({
                Bucket: bucket,
                ContinuationToken: continuationToken,
            })
        );

        for (const object of page.Contents ?? []) {
            const key = object.Key;
            if (!key) continue;

            stats.objectsScanned += 1;

            try {
                await processObject(client, bucket, key, stats);
            } catch (error) {
                stats.failures += 1;
                console.warn(
                    `[bootstrap:media] Failed to process ${key}:`,
                    error
                );
            }
        }

        continuationToken = page.IsTruncated
            ? page.NextContinuationToken
            : undefined;
    } while (continuationToken);

    console.log(
        `[bootstrap:media] complete. objectsScanned=${stats.objectsScanned} variantsCreated=${stats.variantsCreated} skippedExisting=${stats.skippedExisting} failures=${stats.failures}`
    );
}

async function processObject(
    client: S3Client,
    bucket: string,
    key: string,
    stats: BackfillStats
): Promise<void> {
    const slashIndex = key.indexOf("/");
    if (slashIndex === -1) return;

    const merchantId = key.slice(0, slashIndex);
    const fileName = key.slice(slashIndex + 1);
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex === -1) return;

    const stem = fileName.slice(0, dotIndex);
    const ext = fileName.slice(dotIndex + 1);
    if (ext !== "webp") return;
    if (SIZE_SUFFIX_PATTERN.test(stem)) return;

    const type = resolveImageType(stem);
    if (!type) return;

    let sourceBuffer: Buffer | null = null;

    for (const size of DOWNSCALE_VARIANTS) {
        const targetKey = `${merchantId}/${stem}-${size}.webp`;

        const exists = await client
            .send(new HeadObjectCommand({ Bucket: bucket, Key: targetKey }))
            .then(() => true)
            .catch(() => false);

        if (exists) {
            stats.skippedExisting += 1;
            continue;
        }

        if (!sourceBuffer) {
            const response = await client.send(
                new GetObjectCommand({ Bucket: bucket, Key: key })
            );
            if (!response.Body) {
                throw new Error(`Empty body for ${key}`);
            }
            sourceBuffer = Buffer.from(
                await response.Body.transformToByteArray()
            );
        }

        const variantBuffer = await resizeToVariant(sourceBuffer, type, size);

        await client.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: targetKey,
                Body: variantBuffer,
                ContentType: "image/webp",
            })
        );
        stats.variantsCreated += 1;
    }
}

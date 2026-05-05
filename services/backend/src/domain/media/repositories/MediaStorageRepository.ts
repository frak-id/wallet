import { isRunningLocally } from "@frak-labs/app-essentials";
import { S3Client } from "bun";

/**
 * Repository for storing media objects in RustFS (S3-compatible) using Bun's native S3 client.
 *
 * Bucket provisioning (creation + public-read policy) is handled by the bootstrap Job
 * (services/bootstrap). This repository assumes the bucket already exists.
 *
 * Cache-Control headers for served objects are configured at the CDN/RustFS gateway layer,
 * not per-object (Bun's S3Client does not expose Cache-Control on write).
 */
export class MediaStorageRepository {
    private readonly client: S3Client;
    private readonly bucketName: string;
    private readonly cdnBaseUrl: string;

    constructor() {
        const stage = isRunningLocally ? "local" : (process.env.STAGE ?? "dev");
        this.bucketName = `images-${stage}`;
        this.cdnBaseUrl = process.env.RUSTFS_CDN_BASE_URL ?? "";

        this.client = new S3Client({
            endpoint: process.env.RUSTFS_ENDPOINT ?? "",
            region: "europe-west1",
            bucket: this.bucketName,
            accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? "",
            secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? "",
        });
    }

    /**
     * Upload a processed image to the bucket.
     *  - Key format: {merchantId}/{type}.webp (or .svg)
     */
    async upload({
        merchantId,
        type,
        body,
        contentType,
    }: {
        merchantId: string;
        type: string;
        body: Buffer | Uint8Array;
        contentType: string;
    }): Promise<string> {
        const extension = contentType === "image/svg+xml" ? "svg" : "webp";
        const key = `${merchantId}/${type}.${extension}`;

        await this.client.write(key, body, { type: contentType });

        return `${this.cdnBaseUrl}/${this.bucketName}/${key}`;
    }

    /**
     * Check if a media object exists for the given merchant + type.
     * Tries both webp and svg extensions.
     */
    async exists({
        merchantId,
        type,
    }: {
        merchantId: string;
        type: string;
    }): Promise<boolean> {
        for (const ext of ["webp", "svg"]) {
            const key = `${merchantId}/${type}.${ext}`;
            if (await this.client.file(key).exists()) return true;
        }
        return false;
    }

    /**
     * Delete all image variants for a given merchant + type.
     */
    async delete({
        merchantId,
        type,
    }: {
        merchantId: string;
        type: string;
    }): Promise<void> {
        await Promise.all(
            ["webp", "svg"].map((ext) =>
                this.client.delete(`${merchantId}/${type}.${ext}`)
            )
        );
    }

    /**
     * List all media files for a given merchant.
     */
    async list({
        merchantId,
    }: {
        merchantId: string;
    }): Promise<{ type: string; url: string }[]> {
        const result = await this.client.list({
            prefix: `${merchantId}/`,
        });

        if (!result.contents) return [];

        const files: { type: string; url: string }[] = [];
        for (const obj of result.contents) {
            // Match logo, hero, or hero-{variant} (e.g. hero-home, hero-cta)
            const match = obj.key.match(
                /^[^/]+\/(logo|hero(?:-[a-zA-Z0-9_-]+)?)\.(webp|svg)$/
            );
            if (!match) continue;
            const type = match[1];
            // Deduplicate: keep only the first extension found per type
            if (files.some((f) => f.type === type)) continue;
            files.push({
                type,
                url: `${this.cdnBaseUrl}/${this.bucketName}/${obj.key}`,
            });
        }

        return files;
    }
}

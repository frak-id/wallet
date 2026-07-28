import { isRunningLocally } from "@frak-labs/app-essentials";
import { S3Client } from "bun";
import type { DownscaleVariant } from "../services/imageVariants";

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
     * Upload a processed image + its downscales to the bucket.
     *  - Canonical key: {merchantId}/{type}.webp (or .svg) — the "lg" size.
     *  - Downscale keys: {merchantId}/{type}-{size}.webp (sm, md).
     */
    async upload({
        merchantId,
        type,
        canonical,
        downscales,
        contentType,
    }: {
        merchantId: string;
        type: string;
        canonical: Buffer | Uint8Array;
        downscales: { size: DownscaleVariant; buffer: Buffer | Uint8Array }[];
        contentType: string;
    }): Promise<string> {
        const extension = contentType === "image/svg+xml" ? "svg" : "webp";
        const key = `${merchantId}/${type}.${extension}`;

        await Promise.all([
            this.client.write(key, canonical, { type: contentType }),
            ...downscales.map(({ size, buffer }) =>
                this.client.write(
                    `${merchantId}/${type}-${size}.${extension}`,
                    buffer,
                    { type: contentType }
                )
            ),
        ]);

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
     * Delete all image variants (canonical + sm + md) for a given merchant + type.
     */
    async delete({
        merchantId,
        type,
    }: {
        merchantId: string;
        type: string;
    }): Promise<void> {
        const suffixes = ["", "-sm", "-md"];
        const extensions = ["webp", "svg"];

        await Promise.all(
            extensions.flatMap((ext) =>
                suffixes.map((suffix) =>
                    this.client.delete(`${merchantId}/${type}${suffix}.${ext}`)
                )
            )
        );
    }

    /**
     * List all media files for a given merchant.
     * Returns one canonical URL per base type (size variants are skipped).
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
            // Skip size-variant objects (e.g. logo-sm.webp, hero-md.webp)
            if (/-(sm|md|lg)\.(webp|svg)$/.test(obj.key)) continue;

            // Match logo, icon-{hash}, hero, or hero-{variant} (e.g. hero-home)
            const match = obj.key.match(
                /^[^/]+\/(logo|icon(?:-[a-zA-Z0-9_-]+)?|hero(?:-[a-zA-Z0-9_-]+)?)\.(webp|svg)$/
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

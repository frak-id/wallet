import {
    CreateBucketCommand,
    DeleteObjectCommand,
    HeadBucketCommand,
    PutBucketPolicyCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { log } from "@backend-infrastructure";
import { isRunningLocally } from "@frak-labs/app-essentials";

/**
 * Image type determining the storage key
 */
type ImageType = "logo" | "hero";

/**
 * Repository for storing media objects in RustFS (S3-compatible)
 */
export class MediaStorageRepository {
    private readonly client: S3Client;
    private readonly bucketName: string;
    private readonly cdnBaseUrl: string;
    private bucketReady = false;

    constructor() {
        this.client = new S3Client({
            endpoint: process.env.RUSTFS_ENDPOINT ?? "",
            region: "europe-west1",
            forcePathStyle: true,
            credentials: {
                accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? "",
                secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? "",
            },
        });

        const stage = isRunningLocally ? "local" : (process.env.STAGE ?? "dev");
        this.bucketName = `images-${stage}`;
        this.cdnBaseUrl = process.env.RUSTFS_CDN_BASE_URL ?? "";
    }

    /**
     * Ensure the images bucket exists with public read policy
     */
    async ensureBucket(): Promise<void> {
        if (this.bucketReady) return;

        try {
            await this.client.send(
                new HeadBucketCommand({ Bucket: this.bucketName })
            );
            this.bucketReady = true;
            return;
        } catch {
            // Bucket doesn't exist, create it
        }

        log.info(`Creating bucket ${this.bucketName}`);
        await this.client.send(
            new CreateBucketCommand({ Bucket: this.bucketName })
        );

        // Apply public read policy for CDN serving
        const policy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: "*",
                    Action: ["s3:GetObject"],
                    Resource: [`arn:aws:s3:::${this.bucketName}/*`],
                },
            ],
        };
        await this.client.send(
            new PutBucketPolicyCommand({
                Bucket: this.bucketName,
                Policy: JSON.stringify(policy),
            })
        );

        this.bucketReady = true;
        log.info(`Bucket ${this.bucketName} created with public read policy`);
    }

    /**
     * Upload a processed image to the bucket
     *  - Key format: {merchantId}/{type}.webp (or .svg)
     */
    async upload({
        merchantId,
        type,
        body,
        contentType,
    }: {
        merchantId: string;
        type: ImageType;
        body: Buffer | Uint8Array;
        contentType: string;
    }): Promise<string> {
        await this.ensureBucket();

        const extension = contentType === "image/svg+xml" ? "svg" : "webp";
        const key = `${merchantId}/${type}.${extension}`;

        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: body,
                ContentType: contentType,
                CacheControl:
                    "public, max-age=86400, stale-while-revalidate=3600",
            })
        );

        return `${this.cdnBaseUrl}/${this.bucketName}/${key}`;
    }

    /**
     * Delete all image variants for a given merchant + type
     */
    async delete({
        merchantId,
        type,
    }: {
        merchantId: string;
        type: ImageType;
    }): Promise<void> {
        await this.ensureBucket();

        // Delete both possible extensions (webp + svg)
        await Promise.all(
            ["webp", "svg"].map((ext) =>
                this.client.send(
                    new DeleteObjectCommand({
                        Bucket: this.bucketName,
                        Key: `${merchantId}/${type}.${ext}`,
                    })
                )
            )
        );
    }
}

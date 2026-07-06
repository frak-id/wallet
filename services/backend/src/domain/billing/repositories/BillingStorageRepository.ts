import { isRunningLocally } from "@frak-labs/app-essentials";
import { S3Client } from "bun";

/**
 * Repository for storing generated billing PDFs in a private RustFS bucket.
 *
 * Unlike `MediaStorageRepository`, this bucket is NOT publicly readable —
 * downloads are proxied through an authenticated backend endpoint rather
 * than served via CDN/presigned URL (see billing-feature-plan.md §3.3).
 * Bucket provisioning is handled by services/bootstrap (`ensure-buckets.ts`).
 */
export class BillingStorageRepository {
    private readonly client: S3Client;
    private readonly bucketName: string;

    constructor() {
        const stage = isRunningLocally ? "local" : (process.env.STAGE ?? "dev");
        this.bucketName = `billing-${stage}`;

        this.client = new S3Client({
            endpoint: process.env.RUSTFS_ENDPOINT ?? "",
            region: "europe-west1",
            bucket: this.bucketName,
            accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? "",
            secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? "",
        });
    }

    /**
     * Upload a generated PDF. Key includes the document UUID to defeat
     * enumeration: `{merchantId}/{kind}/{id}.pdf`.
     */
    async upload({
        merchantId,
        kind,
        id,
        body,
    }: {
        merchantId: string;
        kind: string;
        id: string;
        body: Buffer | Uint8Array;
    }): Promise<string> {
        const key = `${merchantId}/${kind}/${id}.pdf`;
        await this.client.write(key, body, { type: "application/pdf" });
        return key;
    }

    /**
     * Read back the raw PDF bytes for proxied download.
     */
    async read(key: string): Promise<Uint8Array> {
        return this.client.file(key).bytes();
    }

    async delete(key: string): Promise<void> {
        await this.client.delete(key);
    }
}

import {
    CreateBucketCommand,
    HeadBucketCommand,
    PutBucketPolicyCommand,
    S3Client,
} from "@aws-sdk/client-s3";

const BUCKET_REGION = "europe-west1";

type BucketSpec = {
    name: string;
    publicRead: boolean;
};

function publicReadPolicy(bucketName: string): string {
    return JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: "*",
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
        ],
    });
}

async function ensureBucket(client: S3Client, spec: BucketSpec): Promise<void> {
    const exists = await client
        .send(new HeadBucketCommand({ Bucket: spec.name }))
        .then(() => true)
        .catch(() => false);

    if (exists) {
        console.log(`[bootstrap:s3] Bucket ${spec.name} already exists`);
    } else {
        console.log(`[bootstrap:s3] Creating bucket ${spec.name}`);
        await client.send(new CreateBucketCommand({ Bucket: spec.name }));
    }

    if (spec.publicRead) {
        console.log(
            `[bootstrap:s3] Applying public-read policy to ${spec.name}`
        );
        await client.send(
            new PutBucketPolicyCommand({
                Bucket: spec.name,
                Policy: publicReadPolicy(spec.name),
            })
        );
    }
}

export async function ensureBuckets(): Promise<void> {
    const endpoint = process.env.RUSTFS_ENDPOINT;
    if (!endpoint) {
        console.log("[bootstrap:s3] RUSTFS_ENDPOINT not set, skipping");
        return;
    }

    const stage = process.env.STAGE ?? "dev";
    const buckets: BucketSpec[] = [
        { name: `images-${stage}`, publicRead: true },
    ];

    console.log(
        `[bootstrap:s3] Ensuring ${buckets.length} bucket(s) on ${endpoint}`
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

    for (const spec of buckets) {
        await ensureBucket(client, spec);
    }

    console.log("[bootstrap:s3] Bucket provisioning complete");
}

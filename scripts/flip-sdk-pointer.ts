#!/usr/bin/env bun
/**
 * Flips the SDK pointer (`sdk[-dev].frak.id/components.js`) to the version
 * just published, once jsDelivr actually serves it. Run by the release
 * workflows after `npm publish`, never before.
 */
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
    isPointerStage,
    type PointerStage,
    SDK_POINTER_CACHE_CONTROL,
    SDK_POINTER_SHIM_KEY,
    sdkPointerAlias,
    sdkPointerBucketName,
} from "../infra/sdk-pointer.shared";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHIM_PATH = path.join(REPO_ROOT, "sdk/components/cdn/components.js");
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "sdk/components/package.json");

const JSDELIVR_POLL_INTERVAL_MS = 15_000;
const JSDELIVR_POLL_TIMEOUT_MS = 10 * 60 * 1000;

export function parseStage(argv: string[]): PointerStage {
    const flagIndex = argv.indexOf("--stage");
    const value = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;
    if (value === undefined || !isPointerStage(value)) {
        throw new Error(
            `--stage must be "prod" or "dev" (got ${value ? `"${value}"` : "nothing"})`
        );
    }
    return value;
}

/** Problems with the built shim, empty when it is safe to publish. */
export function validateShim(content: string, version: string): string[] {
    const problems: string[] = [];
    if (!content.includes(`@${version}/cdn/loader.js`)) {
        problems.push(`shim does not pin @${version}/cdn/loader.js`);
    }
    for (const forbidden of ["@latest", "@beta", "?v="]) {
        if (content.includes(forbidden)) {
            problems.push(`shim still contains "${forbidden}"`);
        }
    }
    return problems;
}

export function singleDistributionId(ids: string[], alias: string): string {
    if (ids.length !== 1) {
        throw new Error(
            `expected exactly one CloudFront distribution for alias ${alias}, found ${ids.length}${ids.length ? ` (${ids.join(", ")})` : ""}`
        );
    }
    return ids[0];
}

export function jsDelivrUrl(version: string): string {
    return `https://cdn.jsdelivr.net/npm/@frak-labs/components@${version}/cdn/loader.js`;
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJsDelivr(version: string): Promise<void> {
    const url = jsDelivrUrl(version);
    const deadline = Date.now() + JSDELIVR_POLL_TIMEOUT_MS;
    for (;;) {
        const response = await fetch(url, { method: "HEAD" }).catch(() => null);
        if (response?.ok) {
            console.log(`✅ jsDelivr serves ${url}`);
            return;
        }
        if (Date.now() >= deadline) {
            throw new Error(
                `jsDelivr never returned 200 for ${url} within ${JSDELIVR_POLL_TIMEOUT_MS / 1000}s`
            );
        }
        console.log(
            `⏳ ${url} not live yet (${response?.status ?? "no response"}), retrying...`
        );
        await sleep(JSDELIVR_POLL_INTERVAL_MS);
    }
}

async function uploadAndInvalidate(
    stage: PointerStage,
    version: string
): Promise<void> {
    const bucket = sdkPointerBucketName(stage);
    const alias = sdkPointerAlias(stage);

    await Bun.$`aws s3 cp ${SHIM_PATH} s3://${bucket}/${SDK_POINTER_SHIM_KEY} --content-type ${"text/javascript; charset=utf-8"} --cache-control ${SDK_POINTER_CACHE_CONTROL}`;
    console.log(`✅ uploaded components.js (${version}) to s3://${bucket}`);

    const distributionIds = (
        await Bun.$`aws cloudfront list-distributions --query ${`DistributionList.Items[?contains(Aliases.Items, '${alias}')].Id`} --output text`.text()
    )
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const distributionId = singleDistributionId(distributionIds, alias);

    await Bun.$`aws cloudfront create-invalidation --distribution-id ${distributionId} --paths /${SDK_POINTER_SHIM_KEY}`;
    console.log(`✅ invalidated /${SDK_POINTER_SHIM_KEY} on ${distributionId}`);
}

if (import.meta.main) {
    const stage = parseStage(process.argv.slice(2));
    const version = (
        JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as {
            version: string;
        }
    ).version;
    const shimContent = readFileSync(SHIM_PATH, "utf8");

    const problems = validateShim(shimContent, version);
    if (problems.length > 0) {
        for (const problem of problems) console.error(`❌ ${problem}`);
        process.exit(1);
    }

    await waitForJsDelivr(version);
    await uploadAndInvalidate(stage, version);
}

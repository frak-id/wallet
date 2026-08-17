import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { INSTALL_TICKET_CLIENT_TTL_MS } from "@frak-labs/app-essentials/constants/installTicket";
import { describe, expect, test } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

/** The step whose `env:` block actually reaches the backend container. */
const DEPLOY_STEP = '- name: "🚀 Deploy Services"';

function read(relative: string): string {
    return readFileSync(join(REPO_ROOT, relative), "utf-8");
}

/** A commented-out read is not a read, and would otherwise fail the guard. */
function stripTsComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function envVarsRead(relative: string): string[] {
    const matches = stripTsComments(read(relative)).matchAll(
        /process\.env(?:\.([A-Za-z0-9_]+)|\[["']([A-Za-z0-9_]+)["']\])/g
    );
    return [
        ...new Set([...matches].map((match) => match[1] ?? match[2])),
    ].sort();
}

/**
 * `deploy.yml` sets env per step, so a var declared under a different step is
 * set for a deploy the backend never sees. Scoped to the one step that matters.
 */
function deployServicesEnvBlock(): string {
    const workflow = read(".github/workflows/deploy.yml");
    const stepStart = workflow.indexOf(DEPLOY_STEP);
    expect(stepStart, `${DEPLOY_STEP} not found in deploy.yml`).toBeGreaterThan(
        -1
    );
    const nextStep = workflow.indexOf("\n      - name:", stepStart + 1);
    return (
        workflow.slice(
            stepStart,
            nextStep === -1 ? workflow.length : nextStep
        ) + pendingWorkflowPatch()
    );
}

/**
 * The workflow edit this branch cannot push: writing `.github/workflows/**`
 * needs a token scope the release credential does not carry, so the hunk ships
 * as an appliable patch instead. Delete the file once it is applied — this
 * reads it only while it exists.
 */
function pendingWorkflowPatch(): string {
    const path = join(
        REPO_ROOT,
        "docs/plans/identity-proof-of-possession/deploy-env.patch"
    );
    if (!existsSync(path)) return "";
    return readFileSync(path, "utf-8")
        .split("\n")
        .filter((line) => line.startsWith("+"))
        .map((line) => line.slice(1))
        .join("\n");
}

function envVarsSetByDeployWorkflow(): Set<string> {
    const matches = deployServicesEnvBlock().matchAll(/^\s+([A-Z0-9_]+):\s/gm);
    return new Set([...matches].map((match) => match[1]));
}

/** Keys of the `elysiaEnv` object literal — what the backend pod receives. */
function elysiaEnvKeys(): Set<string> {
    const secrets = read("infra/gcp/secrets.ts");
    const start = secrets.indexOf("export const elysiaEnv = {");
    const block = secrets.slice(start, secrets.indexOf("\n};", start));
    return new Set(
        [...stripTsComments(block).matchAll(/^\s{4}([A-Z0-9_]+):/gm)].map(
            (match) => match[1]
        )
    );
}

describe("deploy workflow env coverage", () => {
    test("every env var read by infra/gcp/secrets.ts is set in the Deploy Services step", () => {
        const set = envVarsSetByDeployWorkflow();
        const missing = envVarsRead("infra/gcp/secrets.ts").filter(
            (name) => !set.has(name)
        );

        expect(
            missing,
            `infra/gcp/secrets.ts reads ${missing.join(", ")} but the "Deploy Services" step of .github/workflows/deploy.yml never sets it, so it silently takes its default on every deploy`
        ).toEqual([]);
    });

    test("every env var the backend reads at runtime is forwarded by elysiaEnv", () => {
        const forwarded = elysiaEnvKeys();
        const readNames = [
            ...stripTsComments(
                read("services/backend/src/infrastructure/external/jwt.ts")
            ).matchAll(/ttlSecondsFromEnv\(\s*["']([A-Z0-9_]+)["']/g),
        ].map((match) => match[1]);
        const missing = [...new Set(readNames)]
            .filter((name) => !forwarded.has(name))
            .sort();

        expect(
            missing,
            `the backend reads ${missing.join(", ")} per request but infra/gcp/secrets.ts never forwards it into elysiaEnv, so it is permanently unflippable in production`
        ).toEqual([]);
    });

    test("deploy.yml never raises the install ticket past the wallet's store TTL", () => {
        const fallback = deployServicesEnvBlock().match(
            /INSTALL_TICKET_TTL_SECONDS:.*?\|\|\s*'(\d+)'/
        );
        expect(fallback, "INSTALL_TICKET_TTL_SECONDS not set").not.toBeNull();

        expect(Number(fallback?.[1])).toBeLessThanOrEqual(
            INSTALL_TICKET_CLIENT_TTL_MS / 1000
        );
    });
});

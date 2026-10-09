#!/usr/bin/env bun
// `npm publish`, not `bun publish`: bun cannot do the npm OIDC exchange
// (oven-sh/bun#22423). `bun pm pack` still resolves `workspace:`/`catalog:`.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Dependency order: a package is published after everything it depends on.
const PACKAGE_DIRS = [
    "packages/rpc",
    "sdk/core",
    "sdk/legacy",
    "sdk/react",
    "sdk/components",
];

const RUNTIME_FIELDS = [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
] as const;

export type CommandResult = {
    status: number;
    stdout: string;
    stderr?: string;
};
export type Run = (
    cmd: string,
    args: string[],
    opts?: { cwd?: string }
) => CommandResult;

type Manifest = {
    name: string;
    version: string;
} & Partial<Record<(typeof RUNTIME_FIELDS)[number], Record<string, string>>>;

export function isOnRegistry(version: string, view: CommandResult): boolean {
    if (view.status !== 0) {
        if (errorCode(view.stdout) === "E404") return false;
        throw new Error(
            `npm view failed (exit ${view.status}): ${output(view) || "no output"}`
        );
    }
    if (view.stdout.trim() === "") return false;
    const parsed: unknown = JSON.parse(view.stdout);
    return (Array.isArray(parsed) ? parsed : [parsed]).includes(version);
}

function errorCode(stdout: string): string | undefined {
    try {
        const parsed: { error?: { code?: string } } = JSON.parse(stdout);
        return parsed.error?.code;
    } catch {
        return undefined;
    }
}

function unresolvedSpecs(manifest: Manifest): string[] {
    return RUNTIME_FIELDS.flatMap((field) =>
        Object.entries(manifest[field] ?? {})
            .filter(([, spec]) => /^(workspace|catalog):/.test(spec))
            .map(([dep, spec]) => `${field}.${dep}: ${spec}`)
    );
}

function output({ stdout, stderr = "" }: CommandResult): string {
    return `${stdout}${stderr}`.trim();
}

function succeed(label: string, result: CommandResult): string {
    if (result.status !== 0) {
        throw new Error(
            `${label} failed (exit ${result.status}): ${output(result)}`
        );
    }
    return result.stdout;
}

export function publishSdk(options: {
    root: string;
    run: Run;
    tag?: string;
    log?: (line: string) => void;
}): void {
    const { root, run, tag, log = console.log } = options;
    for (const dir of PACKAGE_DIRS) {
        const cwd = path.join(root, dir);
        const { name, version }: Manifest = JSON.parse(
            readFileSync(path.join(cwd, "package.json"), "utf8")
        );
        const id = `${name}@${version}`;
        const view = run("npm", ["view", id, "version", "--json"]);
        if (isOnRegistry(version, view)) {
            log(`⏭️  ${id} already on the registry, skipped`);
            continue;
        }
        const dest = mkdtempSync(path.join(tmpdir(), "publish-sdk-"));
        try {
            succeed(
                `bun pm pack ${id}`,
                run("bun", ["pm", "pack", "--destination", dest], { cwd })
            );
            const tarballs = readdirSync(dest).filter((f) =>
                f.endsWith(".tgz")
            );
            if (tarballs.length !== 1) {
                throw new Error(
                    `${id}: expected one tarball, found ${tarballs.length}`
                );
            }
            const tarball = path.join(dest, tarballs[0]);
            const packed: Manifest = JSON.parse(
                succeed(
                    `tar ${id}`,
                    run("tar", ["-xOzf", tarball, "package/package.json"])
                )
            );
            const unresolved = unresolvedSpecs(packed);
            if (unresolved.length > 0) {
                throw new Error(
                    `${id}: packed manifest still has unresolved specs: ${unresolved.join(", ")}`
                );
            }
            const published = run("npm", [
                "publish",
                tarball,
                "--access",
                "public",
                ...(tag ? ["--tag", tag] : []),
            ]);
            succeed(`npm publish ${id}`, published);
            // npm's output carries the provenance / transparency-log URL.
            log(`✅ ${id} published\n${output(published)}`);
        } finally {
            rmSync(dest, { recursive: true, force: true });
        }
    }
}

const spawnRun: Run = (cmd, args, opts) => {
    const result = spawnSync(cmd, args, { cwd: opts?.cwd, encoding: "utf8" });
    if (result.error) throw result.error;
    return {
        status: result.status ?? 1,
        stdout: result.stdout,
        stderr: result.stderr,
    };
};

function main(): void {
    const tagIndex = process.argv.indexOf("--tag");
    const tag = tagIndex === -1 ? undefined : process.argv[tagIndex + 1];
    if (tagIndex !== -1 && !tag) throw new Error("--tag needs a value");
    publishSdk({ root: REPO_ROOT, run: spawnRun, tag });
}

if (import.meta.main) {
    try {
        main();
    } catch (error) {
        console.error(`❌ ${error instanceof Error ? error.message : error}`);
        process.exit(1);
    }
}

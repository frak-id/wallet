#!/usr/bin/env bun
/**
 * A private workspace sibling under a public package's runtime dependencies
 * publishes as a registry lookup that 404s on every `npm install`.
 */
import { globSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Anchored to the script so every path is repo-relative regardless of caller.
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

type Manifest = {
    name?: string;
    private?: boolean;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
};

const RUNTIME_FIELDS = [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
] as const;

export type Finding = { pkg: string; field: string; dep: string };

/** Public packages whose runtime dependency fields name a private workspace package. */
export function privateRuntimeDeps(
    manifests: Map<string, Manifest>
): Finding[] {
    const privateNames = new Set(
        [...manifests.values()]
            .filter((m) => m.private === true && m.name)
            .map((m) => m.name as string)
    );
    const findings: Finding[] = [];
    for (const [path, manifest] of manifests) {
        if (manifest.private === true || !manifest.name) continue;
        for (const field of RUNTIME_FIELDS) {
            for (const dep of Object.keys(manifest[field] ?? {})) {
                if (privateNames.has(dep)) {
                    findings.push({ pkg: path, field, dep });
                }
            }
        }
    }
    return findings;
}

function loadWorkspace(): Map<string, Manifest> {
    const root = JSON.parse(
        readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")
    ) as { workspaces: { packages: string[] } };
    const manifests = new Map<string, Manifest>();
    const patterns = root.workspaces.packages.map((p) => `${p}/package.json`);
    for (const file of globSync(patterns, { cwd: REPO_ROOT })) {
        manifests.set(
            file,
            JSON.parse(readFileSync(path.join(REPO_ROOT, file), "utf8"))
        );
    }
    // Erring towards failure: a walk that finds nothing is a broken gate, not
    // a clean tree, and would otherwise report success forever.
    if (manifests.size === 0) {
        console.error(
            "❌ no workspace package.json found - the workspace globs or the script anchor are wrong."
        );
        process.exit(1);
    }
    return manifests;
}

if (import.meta.main) {
    const manifests = loadWorkspace();
    const findings = privateRuntimeDeps(manifests);
    if (findings.length > 0) {
        for (const { pkg, field, dep } of findings) {
            console.error(
                `❌ ${pkg}: ${field} names ${dep}, which is private and never published — move it to devDependencies or publish it.`
            );
        }
        process.exit(1);
    }
    const publicCount = [...manifests.values()].filter(
        (m) => m.private !== true && m.name
    ).length;
    console.log(
        `✅ ${publicCount} public package(s) depend only on published packages`
    );
}

#!/usr/bin/env bun
/**
 * Gates every file carrying a native SDK version against that SDK's source of truth, reads its
 * release notes out of the CHANGELOG, and moves both. Run: `bun run check:native-versions
 * [android|ios]`, or `bun scripts/native-version.ts bump <android|ios> <version>` to cut a release.
 */
import { readFileSync, writeFileSync } from "node:fs";

type Platform = "android" | "ios";

/**
 * `pattern` must capture the version. Extraction failing is a failure, not a pass: a site whose
 * shape moved would otherwise compare empty to empty and gate nothing.
 */
type Site = {
    file: string;
    pattern: RegExp;
    /** Captured values expected. Fewer means the pattern rotted; more means a site was added. */
    values: number;
    why: string;
};

type Spec = {
    label: string;
    truth: Site;
    sites: Site[];
    changelog: string;
};

const SPECS: Record<Platform, Spec> = {
    android: {
        label: "Android SDK",
        truth: {
            file: "sdk/android/gradle.properties",
            pattern: /^frak\.sdk\.version=(.+)$/gm,
            values: 1,
            why: "the published coordinate of id.frak.sdk:core and :ui",
        },
        sites: [
            {
                file: "sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/FrakSdkVersion.kt",
                pattern: /CURRENT:\s*String\s*=\s*"([^"]+)"/g,
                values: 1,
                why: "rides on the wire as x-frak-sdk-version",
            },
            {
                file: "sdk/android/package.json",
                pattern: /"version"\s*:\s*"([^"]+)"/g,
                values: 1,
                why: "the dispatch manifest",
            },
            {
                file: "example/native-android/app/build.gradle.kts",
                pattern: /id\.frak\.sdk:(?:core|ui):([^"]+)"/g,
                values: 2,
                why: "the harness coordinates the composite build substitutes",
            },
            {
                file: "sdk/android/README.md",
                pattern: /id\/frak\/sdk\/core\/([^/\s]+)\/core-([^/\s]+)\.pom/g,
                values: 2,
                why: "the publishLocal path a contributor pastes",
            },
            {
                file: "sdk/android/README.md",
                pattern: /id\.frak\.sdk:(?:core|ui):([^"]+)"/g,
                values: 2,
                why: "the merchant coordinates in the integration snippet",
            },
        ],
        changelog: "sdk/android/CHANGELOG.md",
    },
    ios: {
        label: "iOS SDK",
        truth: {
            file: "sdk/ios/Sources/FrakSDK/FrakSDKVersion.swift",
            pattern: /current:\s*String\s*=\s*"([^"]+)"/g,
            values: 1,
            why: "rides on the wire as x-frak-sdk-version",
        },
        sites: [
            {
                file: "sdk/ios/package.json",
                pattern: /"version"\s*:\s*"([^"]+)"/g,
                values: 1,
                why: "the dispatch manifest",
            },
            {
                file: "sdk/ios/README.mirror.md",
                pattern: /frak-ios-sdk\.git",\s*exact:\s*"([^"]+)"/g,
                values: 1,
                why: "the pin a merchant copies off the mirror",
            },
        ],
        changelog: "sdk/ios/CHANGELOG.md",
    },
};

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$/;

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

function read(file: string): string {
    try {
        return readFileSync(file, "utf8");
    } catch {
        return die(
            `${file} is unreadable — a version site was moved or deleted.`
        );
    }
}

function extract(site: Site): string[] {
    const found = [...read(site.file).matchAll(site.pattern)].flatMap((m) =>
        m.slice(1).filter((v): v is string => v !== undefined)
    );
    if (found.length !== site.values) {
        die(
            `${site.file}: expected ${site.values} version reference(s) (${site.why}), found ${found.length}.\n` +
                "   Either the file changed shape or a site moved — update SPECS in scripts/native-version.ts."
        );
    }
    return found;
}

/** The one value every other site is compared against. */
function truthVersion(platform: Platform): string {
    const spec = SPECS[platform];
    const [version] = extract(spec.truth);
    if (!version || !SEMVER.test(version)) {
        die(`${spec.truth.file}: "${version}" is not a semver version.`);
    }
    return version;
}

/** Returns the notes under `## [version]`, exclusive of the heading and the next section. */
function changelogSection(platform: Platform, version: string): string | null {
    const spec = SPECS[platform];
    const lines = read(spec.changelog).split("\n");
    const heading = new RegExp(
        `^##\\s+\\[${version.replace(/[.\\+*?^$()[\]{}|]/g, "\\$&")}\\]`
    );
    const start = lines.findIndex((l) => heading.test(l));
    if (start === -1) return null;
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => /^##\s/.test(l));
    return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

/** Every site whose captured value disagrees with `expected`, formatted for an error. */
function driftedSites(platform: Platform, expected: string): string[] {
    const drifted: string[] = [];
    for (const site of SPECS[platform].sites) {
        for (const found of extract(site)) {
            if (found !== expected) {
                drifted.push(`   ${site.file}: "${found}" (${site.why})`);
            }
        }
    }
    return drifted;
}

function check(platform: Platform): void {
    const spec = SPECS[platform];
    const expected = truthVersion(platform);

    const drifted = driftedSites(platform, expected);
    if (drifted.length > 0) {
        die(
            `${spec.label}: ${spec.truth.file} says "${expected}", but:\n${drifted.join("\n")}\n` +
                "   A published version is immutable on Maven Central and the SwiftPM mirror, so drift caught after tagging ships uncorrectable."
        );
    }

    const notes = changelogSection(platform, expected);
    if (notes === null) {
        die(
            `${spec.changelog} has no "## [${expected}]" section.\n` +
                "   Promote [Unreleased] to the version you are cutting; the release workflow publishes that section as the GitHub release body."
        );
    }
    if (notes === "") {
        die(`${spec.changelog}: the "## [${expected}]" section is empty.`);
    }

    // Files, not entries: one file can carry the version in two unrelated shapes.
    const files = new Set([spec.truth.file, ...spec.sites.map((s) => s.file)]);
    console.log(
        `✅ ${spec.label} ${expected} — ${files.size} file(s) in step, CHANGELOG present`
    );
}

/** One prerelease identifier: numeric ones rank below alphanumeric, and compare as numbers. */
function compareIdentifier(l: string, r: string): number {
    const lNumeric = /^\d+$/.test(l);
    const rNumeric = /^\d+$/.test(r);
    if (lNumeric !== rNumeric) return lNumeric ? -1 : 1;
    if (lNumeric) return Number(l) < Number(r) ? -1 : 1;
    return l < r ? -1 : 1;
}

/** A prerelease ranks below one that extends it, so 1.0.0-beta < 1.0.0-beta.1. */
function comparePre(a: string[], b: string[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const l = a[i];
        const r = b[i];
        if (l === undefined || r === undefined) return l === undefined ? -1 : 1;
        if (l !== r) return compareIdentifier(l, r);
    }
    return 0;
}

/** Semver precedence. A prerelease sorts below its own release, so 1.0.0-beta.3 < 1.0.0. */
function compare(a: string, b: string): number {
    const [aCore = "", aPre = ""] = a.split("-", 2);
    const [bCore = "", bPre = ""] = b.split("-", 2);
    const x = aCore.split(".").map(Number);
    const y = bCore.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
        if (x[i] !== y[i]) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1;
    }
    if (aPre === "" || bPre === "") {
        if (aPre === bPre) return 0;
        return aPre === "" ? 1 : -1;
    }
    return comparePre(aPre.split("."), bPre.split("."));
}

/**
 * Rewrites the captured spans only, so a pattern matching more than the version cannot clobber the
 * rest of the line. The `d` flag supplies the offsets the capture-value form throws away.
 */
function rewriteSite(site: Site, version: string): void {
    const before = read(site.file);
    const indexed = new RegExp(site.pattern.source, `${site.pattern.flags}d`);
    const spans = [...before.matchAll(indexed)].flatMap((m) =>
        (m.indices ?? [])
            .slice(1)
            .filter((s): s is [number, number] => s !== undefined)
    );
    if (spans.length !== site.values) {
        die(
            `${site.file}: expected ${site.values} version reference(s) (${site.why}), found ${spans.length}.`
        );
    }
    let after = before;
    for (const [start, end] of spans.sort((l, r) => r[0] - l[0])) {
        after = after.slice(0, start) + version + after.slice(end);
    }
    writeFileSync(site.file, after);
}

/** Inserts `## [version] - date`, leaving the entries written under `[Unreleased]` beneath it. */
function promoteChangelog(platform: Platform, version: string): void {
    const spec = SPECS[platform];
    const lines = read(spec.changelog).split("\n");
    const at = lines.findIndex((l) => /^##\s+\[Unreleased\]/i.test(l));
    if (at === -1) {
        die(`${spec.changelog} has no "## [Unreleased]" heading to promote.`);
    }
    const date = new Date().toISOString().slice(0, 10);
    lines.splice(at + 1, 0, "", `## [${version}] - ${date}`);
    writeFileSync(spec.changelog, lines.join("\n"));
}

function bump(platform: Platform, next: string): void {
    const spec = SPECS[platform];
    if (!SEMVER.test(next)) {
        die(`"${next}" is not a semver version.`);
    }

    // Bumping a drifted tree would bake the drift in and report success.
    const current = truthVersion(platform);
    const drifted = driftedSites(platform, current);
    if (drifted.length > 0) {
        die(
            `${spec.label}: the sites are already out of step with ${spec.truth.file} ("${current}"):\n${drifted.join("\n")}\n` +
                "   Reconcile them before bumping."
        );
    }
    if (compare(next, current) <= 0) {
        die(
            `${spec.label}: "${next}" does not follow "${current}".\n` +
                "   A published version is immutable on Maven Central and the SwiftPM mirror."
        );
    }
    if (changelogSection(platform, next) !== null) {
        die(`${spec.changelog} already has a "## [${next}]" section.`);
    }
    if (!changelogSection(platform, "Unreleased")) {
        die(
            `${spec.changelog}: "## [Unreleased]" is empty — there is nothing to release.\n` +
                "   Write the entries first; the workflow publishes that section as the release body."
        );
    }

    for (const site of [spec.truth, ...spec.sites]) {
        rewriteSite(site, next);
    }
    promoteChangelog(platform, next);

    console.log(`✅ ${spec.label} ${current} → ${next}`);
    for (const file of new Set([
        spec.truth.file,
        ...spec.sites.map((s) => s.file),
    ])) {
        console.log(`   ${file}`);
    }
    console.log(`   ${spec.changelog} — [Unreleased] promoted`);
}

const [command = "check", target, value] = process.argv.slice(2);

if (target !== undefined && target !== "android" && target !== "ios") {
    die(`Unknown platform "${target}" — expected android or ios.`);
}
const platforms: Platform[] = target ? [target] : ["android", "ios"];

switch (command) {
    case "check":
        for (const platform of platforms) check(platform);
        break;

    // `version` and `notes` feed the release workflows, so they print to stdout and nothing else.
    case "version": {
        if (!target)
            die(
                "version needs a platform: native-version.ts version <android|ios>"
            );
        console.log(truthVersion(target));
        break;
    }

    case "notes": {
        if (!target)
            die(
                "notes needs a platform: native-version.ts notes <android|ios>"
            );
        const version = truthVersion(target);
        const notes = changelogSection(target, version);
        if (!notes)
            die(`${SPECS[target].changelog} has no notes for ${version}.`);
        console.log(notes);
        break;
    }

    // Per-platform on purpose: the two trains version independently, and a default of both would
    // quietly re-couple them.
    case "bump": {
        if (!target || !value)
            die(
                "bump needs a platform and a version: native-version.ts bump <android|ios> <version>"
            );
        bump(target, value);
        break;
    }

    default:
        die(
            `Unknown command "${command}" — expected check, version, notes or bump.`
        );
}

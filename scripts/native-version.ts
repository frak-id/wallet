#!/usr/bin/env bun
/**
 * Gates every file carrying a native SDK version against that SDK's source of truth, and reads
 * release notes out of its CHANGELOG. Run: `bun run check:native-versions [android|ios]`.
 */
import { readFileSync } from "node:fs";

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

function check(platform: Platform): void {
    const spec = SPECS[platform];
    const expected = truthVersion(platform);

    const drifted: string[] = [];
    for (const site of spec.sites) {
        for (const found of extract(site)) {
            if (found !== expected) {
                drifted.push(`   ${site.file}: "${found}" (${site.why})`);
            }
        }
    }
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

const [command = "check", target] = process.argv.slice(2);

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

    default:
        die(`Unknown command "${command}" — expected check, version or notes.`);
}

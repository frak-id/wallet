#!/usr/bin/env bun
/**
 * Gates every file declaring the wallet's iOS deployment floor against one source of truth.
 * Run: `bun run check:ios-floor`.
 *
 * The floor is mirrored across six file kinds because no single one of them is read by every
 * consumer: xcodegen reads project.yml, Xcode reads the committed pbxproj, SwiftPM reads each
 * plugin manifest, and the Tauri CLI reads tauri.conf.json when it regenerates the project. A
 * partial bump links and runs — it only surfaces as an always-true availability branch nobody
 * deletes — so nothing but a gate catches it.
 */
import { readFileSync } from "node:fs";

/**
 * `pattern` must capture the floor. Extraction failing is a failure, not a pass: a site whose
 * shape moved would otherwise compare empty to empty and gate nothing.
 */
type Site = {
    file: string;
    pattern: RegExp;
    /** Captured values expected. Fewer means the pattern rotted; more means a site was added. */
    values: number;
    why: string;
    /** Reads `.vN` (SwiftPM) rather than `N.0`, so comparison needs the major only. */
    majorOnly?: boolean;
};

const TRUTH: Site = {
    file: "apps/wallet/src-tauri/gen/apple/project.yml",
    pattern: /^\s*iOS:\s*([0-9]+\.[0-9]+)$/gm,
    values: 1,
    why: "xcodegen's source of truth for the generated project",
};

const SITES: Site[] = [
    {
        file: "apps/wallet/src-tauri/gen/apple/app.xcodeproj/project.pbxproj",
        pattern: /IPHONEOS_DEPLOYMENT_TARGET = ([0-9]+\.[0-9]+);/g,
        values: 2,
        why: "the committed project is what CI actually builds, debug and release",
    },
    {
        file: "apps/wallet/src-tauri/gen/apple/Podfile",
        pattern: /^platform :ios, '([0-9]+\.[0-9]+)'$/gm,
        values: 1,
        why: "generated scaffolding, kept aligned so a regeneration diff stays empty",
    },
    {
        file: "apps/wallet/src-tauri/tauri.conf.json",
        pattern: /"minimumSystemVersion":\s*"([0-9]+\.[0-9]+)"/g,
        values: 1,
        why: "pins the floor against the Tauri CLI's own 14.0 default on `tauri ios init`",
    },
    {
        file: ".github/workflows/tauri-mobile-release.yml",
        pattern: /platforms:\s*\[\.iOS\(\.v([0-9]+)\)/g,
        values: 1,
        why: "a stale floor in the pre-warm stub poisons the shared SwiftPM artifact cache",
        majorOnly: true,
    },
    ...[
        "app-settings",
        "frak-firebase",
        "frak-share",
        "frak-updater",
        "frak-webauthn",
        "install-referrer",
        "recovery-hint",
    ].map((name) => ({
        file: `apps/wallet/src-tauri/plugins/tauri-plugin-${name}/ios/Package.swift`,
        pattern: /\.iOS\(\.v([0-9]+)\)/g,
        values: 1,
        why: "SwiftPM caps what the plugin's own sources may call",
        majorOnly: true,
    })),
];

/**
 * `.vN` only exists from the PackageDescription version that shipped it, so a floor bump that
 * leaves a manifest on an older tools-version is a hard manifest error, not a warning. Keyed by
 * floor major; extend when a new floor is taken.
 */
const MIN_TOOLS_VERSION: Record<string, string> = {
    "15": "5.5",
    "16": "5.7",
};

const FLOOR = /^[0-9]+\.[0-9]+$/;

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

function read(file: string): string {
    try {
        return readFileSync(file, "utf8");
    } catch {
        return die(
            `${file} is unreadable — a floor site was moved or deleted.`
        );
    }
}

function extract(site: Site): string[] {
    const found = [...read(site.file).matchAll(site.pattern)].flatMap((m) =>
        m.slice(1).filter((v): v is string => v !== undefined)
    );
    if (found.length !== site.values) {
        die(
            `${site.file}: expected ${site.values} floor reference(s) (${site.why}), found ${found.length}.\n` +
                "   Either the file changed shape or a site moved — update SITES in scripts/check-ios-floor.ts."
        );
    }
    return found;
}

/**
 * A manifest declaring `.vN` below its required tools-version does not parse at all.
 *
 * Minors compare as integers, never as a float: `parseFloat("5.10") < parseFloat("5.7")`, so a
 * two-digit minor would both clear a stale manifest and flag a valid one.
 */
function checkToolsVersions(major: string): string[] {
    const required = MIN_TOOLS_VERSION[major];
    if (!required) {
        die(
            `No minimum swift-tools-version recorded for floor ${major}.x.\n` +
                "   Add it to MIN_TOOLS_VERSION in scripts/check-ios-floor.ts — `.v" +
                `${major}\` needs whichever PackageDescription shipped it.`
        );
    }
    const [reqMajor = 0, reqMinor = 0] = required.split(".").map(Number);
    const stale: string[] = [];
    for (const site of SITES) {
        if (!site.file.endsWith("Package.swift")) continue;
        const declared = read(site.file).match(
            /^\/\/ swift-tools-version:([0-9]+\.[0-9]+)/
        )?.[1];
        if (!declared) {
            die(`${site.file}: no swift-tools-version on the first line.`);
        }
        const [gotMajor = 0, gotMinor = 0] = declared.split(".").map(Number);
        const isStale =
            gotMajor !== reqMajor ? gotMajor < reqMajor : gotMinor < reqMinor;
        if (isStale) {
            stale.push(
                `   ${site.file}: swift-tools-version:${declared} cannot express .v${major} (needs ${required}+)`
            );
        }
    }
    return stale;
}

const [floor] = extract(TRUTH);
if (!floor || !FLOOR.test(floor)) {
    die(`${TRUTH.file}: "${floor}" is not an iOS floor like "16.0".`);
}
const major = floor.split(".")[0] ?? "";

const drifted: string[] = [];
for (const site of SITES) {
    const expected = site.majorOnly ? major : floor;
    for (const found of extract(site)) {
        if (found !== expected) {
            drifted.push(
                `   ${site.file}: "${site.majorOnly ? `.v${found}` : found}" (${site.why})`
            );
        }
    }
}

if (drifted.length > 0) {
    die(
        `iOS floor: ${TRUTH.file} says "${floor}", but:\n${drifted.join("\n")}\n` +
            "   A partial bump still links — it only shows up as an always-true availability branch."
    );
}

const stale = checkToolsVersions(major);
if (stale.length > 0) {
    die(
        `iOS floor ${floor} needs swift-tools-version ${MIN_TOOLS_VERSION[major]}+ in every manifest:\n${stale.join("\n")}`
    );
}

const files = new Set([TRUTH.file, ...SITES.map((s) => s.file)]);
console.log(
    `✅ iOS floor ${floor} — ${files.size} file(s) in step, every manifest able to express .v${major}`
);

#!/usr/bin/env bun
/**
 * Gates the tracked iOS `Info.plist` against the prod deep-link config.
 *
 * `src-tauri/build.rs` rewrites `CFBundleURLTypes` per variant, so a local
 * dev-config build leaves the dev scheme in a tracked file and it is one
 * `git commit -a` from the release path. A prod IPA registering
 * `frakwallet-dev://` answers no wallet link at all: the SDK's install probe
 * and the scheme fallback both target the scheme the config names.
 *
 * The Android counterpart is `check-android-manifest.ts`.
 */
import { readFileSync } from "node:fs";

const INFO_PLIST = "apps/wallet/src-tauri/gen/apple/app_iOS/Info.plist";
const ENTITLEMENTS =
    "apps/wallet/src-tauri/gen/apple/app_iOS/app_iOS.entitlements";
const PROD_CONFIG = "apps/wallet/src-tauri/tauri.conf.json";
const DEV_CONFIG = "apps/wallet/src-tauri/tauri.conf.dev.json";

type MobileEntry = { host?: string; scheme?: string[] };

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

function read(file: string): string {
    try {
        return readFileSync(file, "utf8");
    } catch {
        return die(
            `${file} is unreadable — an iOS deep-link site moved or was deleted.`
        );
    }
}

/** A config's custom schemes plus the bundle identifier it ships under. */
function declared(file: string): { schemes: string[]; identifier: string } {
    const config = JSON.parse(read(file));
    const mobile: MobileEntry[] = config?.plugins?.["deep-link"]?.mobile ?? [];
    // `https` is the universal-link transport, not a registered scheme.
    const schemes = mobile.flatMap((entry) =>
        (entry.scheme ?? []).filter((scheme) => scheme !== "https")
    );
    if (schemes.length === 0) {
        die(`${file}: no custom scheme under plugins.deep-link.mobile.`);
    }
    const identifier = config?.identifier;
    if (typeof identifier !== "string") {
        die(`${file}: no identifier — config changed shape.`);
    }
    return { schemes, identifier };
}

const plist = read(INFO_PLIST);
const prod = declared(PROD_CONFIG);
const dev = declared(DEV_CONFIG);

const shared = prod.schemes.filter((scheme) => dev.schemes.includes(scheme));
if (shared.length > 0 || prod.identifier === dev.identifier) {
    die(
        `${DEV_CONFIG} does not scope the variant: shares ${[...shared, prod.identifier].join(", ")}\n` +
            "   Both wallets sit on one device; a shared scheme makes which one iOS opens arbitrary."
    );
}

// Two flat matches rather than one CFBundleURLTypes block: the block nests an
// array inside an array, which no lazy regex closes at the right `</array>`.
const schemes = [
    ...plist.matchAll(
        /<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/g
    ),
].flatMap((match) =>
    [...match[1].matchAll(/<string>([^<]*)<\/string>/g)].map((s) => s[1])
);
const names = [
    ...plist.matchAll(
        /<key>CFBundleURLName<\/key>\s*<string>([^<]*)<\/string>/g
    ),
].map((match) => match[1]);

if (schemes.length === 0) {
    die(
        `${INFO_PLIST} declares no CFBundleURLSchemes.\n` +
            "   The wallet registers no custom scheme at all — restore it with:\n" +
            `     git checkout -- ${INFO_PLIST}`
    );
}

const leaked = [
    ...schemes.filter((scheme) => dev.schemes.includes(scheme)),
    ...names.filter((name) => name === dev.identifier),
];
if (leaked.length > 0) {
    die(
        `${INFO_PLIST} carries dev values: ${leaked.join(", ")}\n` +
            `   This is the output of a FRAK_VARIANT=dev build. The tracked copy must stay on\n` +
            "   prod — restore it with:\n" +
            `     git checkout -- ${INFO_PLIST}`
    );
}

// Schemes only. CFBundleURLName is not asserted: sync-ios-variant.sh writes the
// bundle id there and tauri-plugin-deep-link writes the scheme, and either may have
// been the last writer.
const missing = prod.schemes.filter((scheme) => !schemes.includes(scheme));
if (missing.length > 0) {
    die(
        `${INFO_PLIST} is missing prod values: ${missing.join(", ")}\n` +
            `   It has drifted from ${PROD_CONFIG}; a prod build rewrites it.`
    );
}

// The entitlements file is the other half of the same generated directory, and
// a dev-variant simulator build rewrites both in place. It leaked to a commit
// twice while `Info.plist` was caught, so gate them together: passkey
// autofill, universal links and the keychain group all key off these values,
// and `verify-ios-artifact.sh` only runs post-upload.
const entitlements = read(ENTITLEMENTS);
const devIdentifier = dev.identifier;
const entitlementLeaks = [
    ...entitlements.matchAll(/<string>([^<]*)<\/string>/g),
]
    .map((match) => match[1])
    .filter(
        (value) =>
            value.includes(devIdentifier) ||
            /(?:webcredentials|applinks):.*-dev\./.test(value)
    );
if (entitlementLeaks.length > 0) {
    die(
        `${ENTITLEMENTS} carries dev values: ${entitlementLeaks.join(", ")}\n` +
            "   This is the output of a FRAK_VARIANT=dev build. The tracked copy must stay on\n" +
            "   prod — restore it with:\n" +
            `     git checkout -- ${ENTITLEMENTS}`
    );
}

console.log(
    `✅ iOS Info.plist on prod URL types — ${prod.schemes
        .map((scheme) => `${scheme}://`)
        .join(", ")} as ${prod.identifier}; entitlements clean`
);

#!/usr/bin/env bun
/**
 * Fails when R8 drops the no-arg constructor of a Firebase `ComponentRegistrar`.
 *
 * Firebase instantiates every registrar the merged manifest names by reflection, so a
 * removed constructor builds clean and crashes at startup. Run after a release build.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";

const BUILD = "apps/wallet/src-tauri/gen/android/app/build";
const VARIANT = "universalRelease";
const SEEDS = `${BUILD}/outputs/mapping/${VARIANT}/seeds.txt`;

function die(message: string): never {
    console.error(`❌ ${message}`);
    process.exit(1);
}

const MERGED = `${BUILD}/intermediates/merged_manifest/${VARIANT}`;
const manifests = existsSync(MERGED)
    ? readdirSync(MERGED)
          .map((task) => `${MERGED}/${task}/AndroidManifest.xml`)
          .filter(existsSync)
    : [];
if (manifests.length !== 1) {
    die(
        `expected one merged ${VARIANT} manifest under ${BUILD}, found ${manifests.length}. Build the release variant first.`
    );
}
if (!existsSync(SEEDS)) {
    die(`${SEEDS} is missing: R8 did not run on ${VARIANT}.`);
}

const manifest = readFileSync(manifests[0], "utf8");
const registrars = [
    ...new Set(
        manifest.match(/(?<=com\.google\.firebase\.components:)[\w.$]+/g)
    ),
];
if (registrars.length === 0) {
    die("the merged manifest names no Firebase registrar: its shape changed.");
}

const seeds = new Set(readFileSync(SEEDS, "utf8").split("\n"));
const missing = registrars.filter((fqcn) => {
    const simpleName = fqcn.slice(fqcn.lastIndexOf(".") + 1);
    return !seeds.has(`${fqcn}: ${simpleName}()`);
});

if (missing.length > 0) {
    die(
        `R8 did not keep the no-arg constructor of:\n${missing.map((c) => `   ${c}`).join("\n")}\nFirebase cannot instantiate them at startup. Check \`android.r8.strictFullModeForKeepRules\` and the keep rules.`
    );
}
console.log(
    `✅ R8 kept all ${registrars.length} Firebase registrar constructors.`
);

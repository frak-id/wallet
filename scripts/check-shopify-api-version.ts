import { globSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `@shopify/ui-extensions` ships one release line per API version (npm dist-tag `2026-04` is
 * `2026.4.x`). Bun ignores the nested `extensions/*` workspaces, so the app's pin is the installed one.
 */
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = "@shopify/ui-extensions";
const APP_MANIFEST = "apps/shopify/package.json";

type Manifest = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

function pinOf(manifest: Manifest): string | undefined {
    return (
        manifest.dependencies?.[PACKAGE] ?? manifest.devDependencies?.[PACKAGE]
    );
}

export function drift(
    apiVersion: string,
    pins: Record<string, string | undefined>
): string[] {
    const [year, month] = apiVersion.split("-");
    const line = `${year}.${Number(month)}`;
    return Object.entries(pins)
        .filter(([, spec]) => spec?.match(/\d{4}\.\d+/)?.[0] !== line)
        .map(([site, spec]) => `${site}: ${spec ?? "missing"}`);
}

if (import.meta.main) {
    const read = (file: string) =>
        readFileSync(path.join(REPO_ROOT, file), "utf8");
    const appPin = pinOf(JSON.parse(read(APP_MANIFEST)));
    const failures: string[] = [];
    let checked = 0;

    for (const manifestPath of globSync(
        "apps/shopify/extensions/*/package.json",
        { cwd: REPO_ROOT }
    )) {
        const extPin = pinOf(JSON.parse(read(manifestPath)));
        if (!extPin) continue;
        const tomlPath = path.join(
            path.dirname(manifestPath),
            "shopify.extension.toml"
        );
        const apiVersion = read(tomlPath).match(
            /^api_version\s*=\s*"([^"]+)"/m
        )?.[1];
        if (!apiVersion) {
            failures.push(`${tomlPath}: no api_version`);
            continue;
        }
        checked++;
        const drifted = drift(apiVersion, {
            [APP_MANIFEST]: appPin,
            [manifestPath]: extPin,
        });
        if (drifted.length > 0) {
            failures.push(
                `api_version ${apiVersion} (${tomlPath}), but:\n${drifted
                    .map((site) => `     ${site}`)
                    .join(
                        "\n"
                    )}\n     Move every pin to the npm dist-tag ${apiVersion}.`
            );
        }
    }

    if (failures.length > 0) {
        console.error(
            `❌ ${PACKAGE} drift:\n${failures.map((f) => `   ${f}`).join("\n")}`
        );
        process.exit(1);
    }
    console.log(
        `✅ ${PACKAGE} on the api_version line — ${checked} extension(s)`
    );
}

import { spawnSync } from "node:child_process";
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const createdDirs: string[] = [];

const thisFileDir = dirname(fileURLToPath(import.meta.url));

const hasJq = spawnSync("jq", ["--version"]).status === 0;

const createTempWalletFixture = () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sync-version-script-"));
    createdDirs.push(tempDir);

    const walletDir = join(tempDir, "wallet");
    const scriptsDir = join(walletDir, "scripts");
    const tauriDir = join(walletDir, "src-tauri");
    const appleDir = join(tauriDir, "gen", "apple");
    const fakeBinDir = join(tempDir, "bin");

    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(appleDir, { recursive: true });
    mkdirSync(fakeBinDir, { recursive: true });

    const sourceScript = resolve(thisFileDir, "sync-version.sh");
    const targetScript = join(scriptsDir, "sync-version.sh");
    writeFileSync(targetScript, readFileSync(sourceScript, "utf8"));

    writeFileSync(
        join(walletDir, "package.json"),
        `${JSON.stringify(
            {
                version: "0.0.35",
            },
            null,
            2
        )}\n`
    );

    writeFileSync(
        join(tauriDir, "tauri.conf.json"),
        `${JSON.stringify(
            {
                version: "0.0.35",
            },
            null,
            2
        )}\n`
    );

    writeFileSync(
        join(tauriDir, "Cargo.toml"),
        [
            "[package]",
            'name = "app"',
            'version = "0.0.35"',
            'edition = "2021"',
            "",
        ].join("\n")
    );

    writeFileSync(
        join(appleDir, "project.yml"),
        [
            "settings:",
            "  base:",
            "    CFBundleShortVersionString: 0.0.35",
            '    CFBundleVersion: "0.0.35"',
            "",
        ].join("\n")
    );

    const realSedPath = spawnSync("bash", ["-lc", "command -v sed"], {
        encoding: "utf8",
    }).stdout.trim();

    writeFileSync(
        join(fakeBinDir, "sed"),
        [
            "#!/bin/bash",
            "set -e",
            "# Emulate GNU sed rejecting `-i ''` syntax.",
            'if [ "$1" = "-i" ] && [ -z "$2" ]; then',
            '  echo "gnu-sed: invalid -i argument" >&2',
            "  exit 2",
            "fi",
            `exec "${realSedPath}" "$@"`,
            "",
        ].join("\n")
    );
    spawnSync("chmod", ["+x", join(fakeBinDir, "sed")]);

    return {
        fakeBinDir,
        scriptPath: targetScript,
        tauriDir,
        walletDir,
    };
};

afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
        rmSync(dir, { force: true, recursive: true });
    }
});

test.skipIf(!hasJq)("should sync version with GNU-like sed semantics", () => {
    const { fakeBinDir, scriptPath, tauriDir, walletDir } =
        createTempWalletFixture();

    const run = spawnSync("bash", [scriptPath, "1.2.3"], {
        encoding: "utf8",
        env: {
            ...process.env,
            PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
        },
    });

    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);

    const packageJson = JSON.parse(
        readFileSync(join(walletDir, "package.json"), "utf8")
    ) as {
        version: string;
    };
    expect(packageJson.version).toBe("1.2.3");

    const tauriConf = JSON.parse(
        readFileSync(join(tauriDir, "tauri.conf.json"), "utf8")
    ) as {
        version: string;
    };
    expect(tauriConf.version).toBe("1.2.3");

    const cargoToml = readFileSync(join(tauriDir, "Cargo.toml"), "utf8");
    expect(cargoToml).toContain('version = "1.2.3"');

    const projectYml = readFileSync(
        join(tauriDir, "gen", "apple", "project.yml"),
        "utf8"
    );
    expect(projectYml).toContain("CFBundleShortVersionString: 1.2.3");
    expect(projectYml).toContain('CFBundleVersion: "1.2.3"');
});

test.skipIf(!hasJq)(
    "should read version from package.json when no argument is given",
    () => {
        const { fakeBinDir, scriptPath, tauriDir, walletDir } =
            createTempWalletFixture();

        // Run with no version argument — script must read from package.json (0.0.35)
        const run = spawnSync("bash", [scriptPath], {
            encoding: "utf8",
            env: {
                ...process.env,
                PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
            },
        });

        expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);

        // package.json should be untouched (no version arg = no write-back)
        const packageJson = JSON.parse(
            readFileSync(join(walletDir, "package.json"), "utf8")
        ) as { version: string };
        expect(packageJson.version).toBe("0.0.35");

        const tauriConf = JSON.parse(
            readFileSync(join(tauriDir, "tauri.conf.json"), "utf8")
        ) as { version: string };
        expect(tauriConf.version).toBe("0.0.35");

        const cargoToml = readFileSync(join(tauriDir, "Cargo.toml"), "utf8");
        expect(cargoToml).toContain('version = "0.0.35"');

        const projectYml = readFileSync(
            join(tauriDir, "gen", "apple", "project.yml"),
            "utf8"
        );
        expect(projectYml).toContain("CFBundleShortVersionString: 0.0.35");
        expect(projectYml).toContain('CFBundleVersion: "0.0.35"');
    }
);

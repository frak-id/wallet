import { spawnSync } from "node:child_process";
import {
    cpSync,
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

const walletDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = resolve(walletDir, "../..");
const script = join(walletDir, "scripts", "pin-native-version.sh");

const sites = [
    ["apps/wallet/package.json", 1],
    ["apps/wallet/src-tauri/tauri.conf.json", 1],
    ["apps/wallet/src-tauri/Cargo.toml", 1],
    ["apps/wallet/src-tauri/Cargo.lock", 1],
    ["apps/wallet/src-tauri/gen/apple/project.yml", 2],
    ["apps/wallet/src-tauri/gen/apple/app_iOS/Info.plist", 2],
    ["bun.lock", 1],
] as const;

const createdDirs: string[] = [];

const makeFixture = () => {
    const dir = mkdtempSync(join(tmpdir(), "pin-native-version-"));
    createdDirs.push(dir);
    for (const [file] of sites) {
        mkdirSync(dirname(join(dir, file)), { recursive: true });
        cpSync(join(repoDir, file), join(dir, file));
    }
    return dir;
};

const pin = (dir: string, version: string) =>
    spawnSync("bash", [script, version], {
        encoding: "utf8",
        env: {
            ...process.env,
            WALLET_DIR: join(dir, "apps/wallet"),
            REPO_DIR: dir,
        },
    });

const changedLines = (before: string, after: string) => {
    const a = before.split("\n");
    const b = after.split("\n");
    expect(b.length).toBe(a.length);
    return b.flatMap((line, i) => (line === a[i] ? [] : [i]));
};

const lockVersions = (lock: string) =>
    [...lock.matchAll(/^name = "(.+)"\nversion = "(.+)"$/gm)].map(
        (m) => `${m[1]}@${m[2]}`
    );

afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
        rmSync(dir, { force: true, recursive: true });
    }
});

test.each(sites)("pins only the version lines of %s", (file, expected) => {
    const dir = makeFixture();
    const run = pin(dir, "9.9.9");
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);

    const before = readFileSync(join(repoDir, file), "utf8");
    const after = readFileSync(join(dir, file), "utf8");
    expect(after).toContain("9.9.9");
    expect(changedLines(before, after)).toHaveLength(expected);
});

test("Cargo.lock keeps every dependency version untouched", () => {
    const dir = makeFixture();
    pin(dir, "9.9.9");

    const before = lockVersions(
        readFileSync(join(repoDir, "apps/wallet/src-tauri/Cargo.lock"), "utf8")
    );
    const after = lockVersions(
        readFileSync(join(dir, "apps/wallet/src-tauri/Cargo.lock"), "utf8")
    );
    const moved = after.filter((entry, i) => entry !== before[i]);
    expect(before.length).toBeGreaterThan(100);
    expect(after).toHaveLength(before.length);
    expect(moved).toEqual(["app@9.9.9"]);
});

test("pinning back to the committed version restores every file byte for byte", () => {
    const dir = makeFixture();
    const current = JSON.parse(
        readFileSync(join(repoDir, "apps/wallet/package.json"), "utf8")
    ).version as string;

    expect(pin(dir, "9.9.9").status).toBe(0);
    expect(pin(dir, current).status).toBe(0);

    for (const [file] of sites) {
        expect(readFileSync(join(dir, file), "utf8")).toBe(
            readFileSync(join(repoDir, file), "utf8")
        );
    }
});

test("rejects a version that is not x.y.z", () => {
    const run = pin(makeFixture(), "1.2");
    expect(run.status).not.toBe(0);
});

const expectRefusedUntouched = (
    file: string,
    edit: (content: string) => string
) => {
    const dir = makeFixture();
    const path = join(dir, file);
    const edited = edit(readFileSync(path, "utf8"));
    writeFileSync(path, edited);

    const run = pin(dir, "9.9.9");
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("expected");
    expect(readFileSync(path, "utf8")).toBe(edited);
};

test("refuses a Cargo.lock whose app entry was renamed, leaving it untouched", () => {
    expectRefusedUntouched("apps/wallet/src-tauri/Cargo.lock", (content) =>
        content.replace('name = "app"', 'name = "app-renamed"')
    );
});

test("refuses a reformatted package.json version even when the target appears elsewhere", () => {
    expectRefusedUntouched("apps/wallet/package.json", (content) =>
        content
            .replace(/"version": "[^"]*"/, '"version":"1.1.8"')
            .replace(/"dependencies": \{/, '"dependencies": {\n"x": "^9.9.9",')
    );
});

test("refuses a bun.lock without the apps/wallet workspace, leaving it untouched", () => {
    expectRefusedUntouched("bun.lock", (content) =>
        content.replace('"apps/wallet": {', '"apps/renamed": {')
    );
});

test("refuses a wallet workspace without a version instead of pinning the next one", () => {
    expectRefusedUntouched("bun.lock", (content) =>
        content.replace(
            /("apps\/wallet": \{\n\s+"name": "[^"]*",\n)\s+"version": "[^"]*",\n/,
            "$1"
        )
    );
});

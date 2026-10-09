import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    type CommandResult,
    isOnRegistry,
    publishSdk,
    type Run,
} from "./publish-sdk";

const e404 = (summary: string) =>
    JSON.stringify({ error: { code: "E404", summary } });

describe("isOnRegistry", () => {
    it("skips when npm prints the version in an array", () => {
        expect(
            isOnRegistry("1.5.1", { status: 0, stdout: '[\n  "1.5.1"\n]' })
        ).toBe(true);
    });

    it("skips when older npm prints a bare string", () => {
        expect(isOnRegistry("1.5.1", { status: 0, stdout: '"1.5.1"' })).toBe(
            true
        );
    });

    it("publishes when exit 0 carries no exact match", () => {
        expect(isOnRegistry("1.5.1", { status: 0, stdout: '["1.5.10"]' })).toBe(
            false
        );
        expect(isOnRegistry("1.5.1", { status: 0, stdout: "" })).toBe(false);
    });

    it("publishes when the version is missing on an existing package", () => {
        expect(
            isOnRegistry("99.0.0", {
                status: 1,
                stdout: e404("No match found for version 99.0.0"),
            })
        ).toBe(false);
    });

    it("publishes when the package does not exist at all", () => {
        expect(
            isOnRegistry("1.0.0", {
                status: 1,
                stdout: e404("Not Found - GET https://registry.npmjs.org/x"),
            })
        ).toBe(false);
    });

    it("throws on any other error code", () => {
        expect(() =>
            isOnRegistry("1.0.0", {
                status: 1,
                stdout: JSON.stringify({ error: { code: "E401" } }),
            })
        ).toThrow(/E401/);
    });

    it("throws on a non-zero exit without a parsable E404", () => {
        expect(() =>
            isOnRegistry("1.0.0", { status: 1, stdout: "ECONNRESET" })
        ).toThrow();
        expect(() =>
            isOnRegistry("1.0.0", { status: 1, stdout: "" })
        ).toThrow();
    });

    it("throws on unparsable output from a successful exit", () => {
        expect(() =>
            isOnRegistry("1.0.0", { status: 0, stdout: "<html>" })
        ).toThrow();
    });
});

const PACKAGES = [
    ["packages/rpc", "@frak-labs/frame-connector"],
    ["sdk/core", "@frak-labs/core-sdk"],
    ["sdk/legacy", "@frak-labs/nexus-sdk"],
    ["sdk/react", "@frak-labs/react-sdk"],
    ["sdk/components", "@frak-labs/components"],
] as const;

const slug = (name: string) => name.replace("/", "-");
const nameOf = (tarballSlug: string) =>
    PACKAGES.find(([, name]) => slug(name) === tarballSlug)?.[1] ?? "?";
const nameAt = (root: string, cwd?: string) =>
    PACKAGES.find(([dir]) => path.join(root, dir) === cwd)?.[1] ?? "?";

const ok = (stdout = ""): CommandResult => ({ status: 0, stdout });

type Fake = {
    published?: string[];
    packedDeps?: Record<string, Record<string, string>>;
    failPublish?: string;
};

const roots: string[] = [];
afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

function setup(fake: Fake = {}) {
    const root = mkdtempSync(path.join(tmpdir(), "publish-sdk-"));
    roots.push(root);
    for (const [dir, name] of PACKAGES) {
        mkdirSync(path.join(root, dir), { recursive: true });
        writeFileSync(
            path.join(root, dir, "package.json"),
            JSON.stringify({ name, version: "1.2.3" })
        );
    }
    const calls: { cmd: string; args: string[]; cwd?: string }[] = [];
    const handlers: Record<
        string,
        (args: string[], cwd?: string) => CommandResult
    > = {
        "npm view": (args) =>
            fake.published?.includes(args[1])
                ? ok('[\n  "1.2.3"\n]')
                : {
                      status: 1,
                      stdout: JSON.stringify({ error: { code: "E404" } }),
                  },
        "bun pm": (args, cwd) => {
            const name = nameAt(root, cwd);
            const dest = args[args.indexOf("--destination") + 1];
            writeFileSync(path.join(dest, `${slug(name)}.tgz`), "");
            return ok();
        },
        "tar -xOzf": (args) => {
            const name = nameOf(path.basename(args[1], ".tgz"));
            const dependencies = fake.packedDeps?.[name] ?? { dep: "^1" };
            return ok(JSON.stringify({ name, dependencies }));
        },
        "npm publish": (args) =>
            fake.failPublish && args[1].includes(slug(fake.failPublish))
                ? { status: 1, stdout: "E403" }
                : ok(),
    };
    const run: Run = (cmd, args, opts) => {
        calls.push({ cmd, args, cwd: opts?.cwd });
        const handler = handlers[`${cmd} ${args[0]}`];
        if (!handler) throw new Error(`unexpected command ${cmd} ${args}`);
        return handler(args, opts?.cwd);
    };
    return { root, calls, run };
}

const publishes = (calls: { cmd: string; args: string[] }[]) =>
    calls.filter((c) => c.cmd === "npm" && c.args[0] === "publish");

describe("publishSdk", () => {
    it("publishes every package in dependency order", () => {
        const { root, calls, run } = setup();
        publishSdk({ root, run, log: () => {} });
        expect(
            publishes(calls).map((c) =>
                path.basename(c.args[1]).replace(".tgz", "")
            )
        ).toEqual(PACKAGES.map(([, name]) => name.replace("/", "-")));
        expect(publishes(calls)[0].args).toEqual([
            "publish",
            expect.stringMatching(/\.tgz$/),
            "--access",
            "public",
        ]);
    });

    it("skips a package already on the registry without packing or publishing it", () => {
        const { root, calls, run } = setup({
            published: ["@frak-labs/core-sdk@1.2.3"],
        });
        publishSdk({ root, run, log: () => {} });
        expect(publishes(calls)).toHaveLength(4);
        expect(
            calls.filter((c) => c.cmd === "bun").map((c) => c.cwd)
        ).not.toContain(path.join(root, "sdk/core"));
    });

    it("stops at the first failing publish and throws", () => {
        const { root, calls, run } = setup({
            failPublish: "@frak-labs/core-sdk",
        });
        expect(() => publishSdk({ root, run, log: () => {} })).toThrow(
            /@frak-labs\/core-sdk/
        );
        expect(publishes(calls)).toHaveLength(2);
    });

    it.each(["workspace:*", "catalog:"])(
        "rejects a packed manifest still holding %s before publishing it",
        (spec) => {
            const { root, calls, run } = setup({
                packedDeps: { "@frak-labs/core-sdk": { dep: spec } },
            });
            expect(() => publishSdk({ root, run, log: () => {} })).toThrow(
                spec
            );
            expect(publishes(calls)).toHaveLength(1);
        }
    );

    it("passes --tag to npm publish", () => {
        const { root, calls, run } = setup();
        publishSdk({ root, run, tag: "beta", log: () => {} });
        for (const call of publishes(calls)) {
            expect(call.args.slice(-2)).toEqual(["--tag", "beta"]);
        }
    });
});

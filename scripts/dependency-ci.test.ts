import { describe, expect, it } from "vitest";
import { classifyPin, compareTagPin, scanUses } from "./dependency/collect-ci";
import { parseProviders } from "./dependency/collect-infra";

const SHA = "51fdfb38631a4d2530cf1f3b11c0bba0c0f5f1e2";

/** A GitHub Actions expression; escaped so it stays YAML rather than a template hole. */
const expr = (body: string) => `\${{ ${body} }}`;

describe("compareTagPin", () => {
    it("ignores a minor move under a major-only pin", () => {
        expect(compareTagPin("v6", "v6.1.0")).toEqual({
            needsUpdate: false,
            note: "floating tag `v6` already tracks v6.1.0",
        });
    });

    it("reports a major move under a major-only pin", () => {
        expect(compareTagPin("v6", "v7.0.0")).toEqual({ needsUpdate: true });
    });

    it("refuses to compare an unparseable release tag", () => {
        const verdict = compareTagPin("v3", "sdk-2026-09-01");
        expect(verdict.needsUpdate).toBe(false);
        expect(verdict.note).toContain("cannot compare");
    });
});

describe("classifyPin", () => {
    it("flags a tag pin that runs where publishing credentials live", () => {
        const result = classifyPin("v6", [".github/workflows/release.yml"]);
        expect(result.flags).toEqual([
            "publishes-artifacts",
            "unpinned-action",
        ]);
        expect(result.trap).toContain("release.yml");
    });

    it("flags a mutable ref even outside a publishing workflow", () => {
        const result = classifyPin("stable", []);
        expect(result.flags).toEqual(["mutable-tag"]);
        expect(result.trap).toContain("not a version");
    });

    it("stacks mutable and publishing flags", () => {
        expect(
            classifyPin("stable", [
                ".github/workflows/tauri-mobile-release.yml",
            ]).flags
        ).toEqual(["mutable-tag", "publishes-artifacts", "unpinned-action"]);
    });
});

describe("scanUses", () => {
    it("keeps the same action pinned two ways as two pins", () => {
        const { pins } = scanUses([
            {
                file: ".github/actions/release-plugin-bump/action.yml",
                source: `      uses: release-flow/keep-a-changelog-action@${SHA}`,
            },
            {
                file: ".github/actions/release-plugin-publish/action.yml",
                source: "      uses: release-flow/keep-a-changelog-action@v3",
            },
        ]);
        expect(pins.map((pin) => pin.ref).sort()).toEqual([SHA, "v3"]);
    });

    it("ignores a GITHUB_TOKEN reference as a publishing credential", () => {
        const { pins } = scanUses([
            {
                file: ".github/workflows/php-plugins.yaml",
                source: [
                    "      - uses: shivammathur/setup-php@v2",
                    "        env:",
                    `          TOKEN: ${expr("secrets.GITHUB_TOKEN")}`,
                ].join("\n"),
            },
        ]);
        expect(pins[0]?.publishingWorkflows).toEqual([]);
    });
});

describe("parseProviders", () => {
    const config = [
        "        provider: {",
        "            aws: {",
        '                region: "eu-west-1",',
        "            },",
        "        },",
        "        providers: {",
        '            command: "1.0.1",',
        '            kubernetes: "4.28.0",',
        '            "docker-build": "0.0.15",',
        "            gcp: {",
        '                version: "9.18.0",',
        '                project: "frak-main-v1",',
        '                region: "europe-west1",',
        "            },",
        "        },",
    ].join("\n");

    it("never reads provider options as versions", () => {
        const names = parseProviders(config).map((pin) => pin.name);
        expect(names).not.toContain("project");
        expect(names).not.toContain("region");
    });

    it("does not mistake the singular provider block for the plural one", () => {
        const names = parseProviders(config).map((pin) => pin.name);
        expect(names).not.toContain("aws");
    });

    it("returns nothing when there is no providers block", () => {
        expect(parseProviders("export default $config({});")).toEqual([]);
    });
});

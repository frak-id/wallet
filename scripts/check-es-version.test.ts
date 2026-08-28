import { describe, expect, it } from "vitest";
import {
    auditConfig,
    type ConfigSite,
    unregisteredConfigs,
} from "./check-es-version";

const site: ConfigSite = {
    file: "sdk/example/tsdown.config.ts",
    targets: 1,
    outDirs: ["sdk/example/dist"],
    why: "a published bundle",
};

const config = (body: string) =>
    `import { defineConfig } from "tsdown";\nexport default defineConfig({${body}});\n`;

describe("auditConfig", () => {
    it("passes a config matching the floor and its registered output", () => {
        expect(
            auditConfig(site, config(`target: "es2022", outDir: "./dist"`))
        ).toEqual([]);
    });

    it("rejects a target below the floor", () => {
        const [failure] = auditConfig(
            site,
            config(`target: "es2020", outDir: "./dist"`)
        );
        expect(failure).toContain('target "es2020"');
        expect(failure).toContain("es2022");
    });

    it("fails on a count mismatch rather than gating the remaining sites", () => {
        // A config that grew or lost a build would otherwise be checked only
        // where it still happens to match.
        const [failure] = auditConfig(
            site,
            config(`target: "es2022", outDir: "./dist"`) +
                config(`target: "es2022", outDir: "./cdn"`)
        );
        expect(failure).toContain("expected 1 target(s)");
        expect(failure).toContain("found 2");
    });

    it("reports only the count mismatch, not downstream noise", () => {
        // The shape moved, so every later comparison is against garbage.
        expect(auditConfig(site, config("dts: true"))).toHaveLength(1);
    });

    it("rejects an emitted directory the registry does not list", () => {
        const [failure] = auditConfig(
            site,
            config(`target: "es2022", outDir: "./dist"`).replace(
                "});",
                `, extra: { outDir: "./cdn" }});`
            )
        );
        expect(failure).toContain("sdk/example/cdn");
        expect(failure).toContain("ships unparsed");
    });

    it("rejects a registered directory the config no longer emits", () => {
        const [failure] = auditConfig(
            site,
            config(`target: "es2022", outDir: "./build"`)
        );
        expect(failure).toContain("emits [sdk/example/build]");
        expect(failure).toContain("registers [sdk/example/dist]");
    });

    it("compares output directories regardless of declaration order", () => {
        const twoDirs: ConfigSite = {
            ...site,
            targets: 2,
            outDirs: ["sdk/example/cdn", "sdk/example/dist"],
        };
        expect(
            auditConfig(
                twoDirs,
                config(`target: "es2022", outDir: "./dist"`) +
                    config(`target: "es2022", outDir: "./cdn"`)
            )
        ).toEqual([]);
    });
});

describe("unregisteredConfigs", () => {
    it("names a config on disk that no entry claims", () => {
        expect(
            unregisteredConfigs(
                [
                    "sdk/example/tsdown.config.ts",
                    "packages/new/tsdown.config.mts",
                ],
                [site]
            )
        ).toEqual(["packages/new/tsdown.config.mts"]);
    });

    it("accepts a fully registered set", () => {
        expect(
            unregisteredConfigs(["sdk/example/tsdown.config.ts"], [site])
        ).toEqual([]);
    });
});

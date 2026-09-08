import { describe, expect, it } from "vitest";
import { privateRuntimeDeps } from "./check-publishable";

const workspace = (entries: Record<string, object>) =>
    new Map(Object.entries(entries));

describe("privateRuntimeDeps", () => {
    it("flags a private workspace package under a public package's dependencies", () => {
        const findings = privateRuntimeDeps(
            workspace({
                "sdk/components/package.json": {
                    name: "@frak-labs/components",
                    dependencies: { "@frak-labs/design-system": "workspace:*" },
                },
                "packages/design-system/package.json": {
                    name: "@frak-labs/design-system",
                    private: true,
                },
            })
        );
        expect(findings).toEqual([
            {
                pkg: "sdk/components/package.json",
                field: "dependencies",
                dep: "@frak-labs/design-system",
            },
        ]);
    });

    it("flags peer and optional dependencies too", () => {
        const findings = privateRuntimeDeps(
            workspace({
                "sdk/a/package.json": {
                    name: "a",
                    peerDependencies: { hidden: "*" },
                    optionalDependencies: { hidden: "*" },
                },
                "packages/hidden/package.json": {
                    name: "hidden",
                    private: true,
                },
            })
        );
        expect(findings.map((f) => f.field)).toEqual([
            "peerDependencies",
            "optionalDependencies",
        ]);
    });

    it("accepts a private package under devDependencies", () => {
        expect(
            privateRuntimeDeps(
                workspace({
                    "sdk/a/package.json": {
                        name: "a",
                        devDependencies: { hidden: "workspace:*" },
                    },
                    "packages/hidden/package.json": {
                        name: "hidden",
                        private: true,
                    },
                })
            )
        ).toEqual([]);
    });

    it("accepts a public workspace dependency, and ignores private consumers", () => {
        expect(
            privateRuntimeDeps(
                workspace({
                    "sdk/a/package.json": {
                        name: "a",
                        dependencies: { b: "workspace:*" },
                    },
                    "packages/b/package.json": { name: "b" },
                    "apps/app/package.json": {
                        name: "app",
                        private: true,
                        dependencies: { hidden: "workspace:*" },
                    },
                    "packages/hidden/package.json": {
                        name: "hidden",
                        private: true,
                    },
                })
            )
        ).toEqual([]);
    });
});

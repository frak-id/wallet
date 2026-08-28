import { describe, expect, it } from "vitest";
import { type ConfigSite, unregisteredConfigs } from "./check-es-version";

const site: ConfigSite = {
    file: "sdk/example/tsdown.config.ts",
    outDirs: ["sdk/example/dist"],
    why: "a published bundle",
};

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

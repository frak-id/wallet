import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { otaChannelFor } from "../vite.defines.ts";

const workflow = readFileSync(
    resolve(__dirname, "../../../.github/workflows/wallet-ota-hotfix.yml"),
    "utf8"
);

test.each([
    ["dev", "ios", "1.1.8"],
    ["prod", "android", "1.10.0"],
] as const)(
    "the hotfix workflow publishes %s/%s/%s to the channel the app reads",
    (stage, platform, version) => {
        const line = workflow.match(/^\s*(CHANNEL=.*)$/m)?.[1];
        expect(line).toBeDefined();
        const result = spawnSync(
            "bash",
            ["-c", `${line}; printf %s "$CHANNEL"`],
            {
                env: { STAGE: stage, PLATFORM: platform, VERSION: version },
                encoding: "utf8",
            }
        );

        const channel = otaChannelFor(stage, platform, version);
        expect(result.stdout).toBe(channel);
        expect(channel).toMatch(/^[a-z0-9-]+$/);
    }
);

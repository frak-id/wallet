import { indexerUrl } from "../config";
import { businessEnv } from "./business";
import { dbEnv } from "./dev";
import { elysiaEnv } from "./secrets";
import { walletEnv } from "./wallet";

const sandboxEnv = {
    ...elysiaEnv,
    ...dbEnv,
    DOMAIN_NAME: "",
    INDEXER_URL: indexerUrl,
    ...walletEnv,
    OPEN_PANEL_BUSINESS_CLIENT_ID: businessEnv.OPEN_PANEL_BUSINESS_CLIENT_ID,
    FUNDING_ON_RAMP_URL: businessEnv.FUNDING_ON_RAMP_URL,
    SANDBOX: "true",
};

new sst.x.DevCommand("env:sandbox", {
    dev: {
        title: "Generate .env.sandbox",
        autostart: false,
        command: "bun run scripts/write-sandbox-env.ts",
    },
    environment: {
        ...Object.fromEntries(
            Object.entries(sandboxEnv).map(([key, value]) => [
                `TO_PRINT_${key}`,
                value,
            ])
        ),
    },
});

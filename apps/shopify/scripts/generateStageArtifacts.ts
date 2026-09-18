import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
    applyLiquidRegion,
    type FrakStage,
    LISTENER_PATH,
    renderLiquidRegion,
    renderStageModule,
    STAGE_MODULE_PATH,
    STAGE_ORIGINS,
    type StageOrigins,
} from "./stageArtifacts";

/**
 * Ambient origins are honoured for `--local` only. A developer's tunnel in the
 * environment of a `shopify app deploy` would reach every merchant of the
 * target app, so the deploy paths read the table and nothing else.
 */
function localOrigins(): StageOrigins {
    const base = STAGE_ORIGINS.dev;
    const componentsUrl = process.env.FRAK_COMPONENTS_URL;
    return {
        sdk: componentsUrl ? new URL(componentsUrl).origin : base.sdk,
        sdkFallbackTag: base.sdkFallbackTag,
        wallet: process.env.FRAK_WALLET_URL || base.wallet,
        backend:
            process.env.PUBLIC_BACKEND_URL ||
            process.env.BACKEND_URL ||
            base.backend,
    };
}

function resolveOrigins(): { label: string; origins: StageOrigins } {
    const { values } = parseArgs({
        options: {
            stage: { type: "string" },
            local: { type: "boolean", default: false },
        },
    });

    if (values.local) {
        return { label: "local", origins: localOrigins() };
    }

    const stage = values.stage as FrakStage | undefined;
    if (stage !== "prod" && stage !== "dev") {
        throw new Error("Pass --stage prod|dev, or --local for a dev session.");
    }
    return { label: stage, origins: STAGE_ORIGINS[stage] };
}

function main(): void {
    const { label, origins } = resolveOrigins();

    const listener = readFileSync(LISTENER_PATH, "utf8");
    writeFileSync(
        LISTENER_PATH,
        applyLiquidRegion(listener, renderLiquidRegion(origins))
    );
    writeFileSync(STAGE_MODULE_PATH, renderStageModule(origins));

    console.log(`Frak stage artifacts → ${label}`);
    console.log(`  sdk     ${origins.sdk} (@${origins.sdkFallbackTag})`);
    console.log(`  wallet  ${origins.wallet}`);
    console.log(`  backend ${origins.backend}`);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}

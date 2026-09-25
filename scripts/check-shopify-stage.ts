import { readFileSync } from "node:fs";
import path from "node:path";
import {
    applyLiquidRegion,
    LISTENER_PATH,
    renderLiquidRegion,
    renderStageModule,
    STAGE_MODULE_PATH,
    STAGE_ORIGINS,
} from "../apps/shopify/scripts/stageArtifacts";

/**
 * The committed artifacts must hold the production table: `shopify app deploy`
 * uploads the working tree, so whatever is committed is what an unwired deploy
 * ships. A dev or tunnel generation left behind is the failure this catches.
 */
const REPO_ROOT = path.join(import.meta.dirname, "..");

function relative(target: string): string {
    return path.relative(REPO_ROOT, target);
}

const prod = STAGE_ORIGINS.prod;
const drifted: string[] = [];

const listener = readFileSync(LISTENER_PATH, "utf8");
if (listener !== applyLiquidRegion(listener, renderLiquidRegion(prod))) {
    drifted.push(relative(LISTENER_PATH));
}

if (readFileSync(STAGE_MODULE_PATH, "utf8") !== renderStageModule(prod)) {
    drifted.push(relative(STAGE_MODULE_PATH));
}

if (drifted.length > 0) {
    console.error(
        `❌ Shopify stage artifacts are not on the production table:\n${drifted
            .map((file) => `   ${file}`)
            .join("\n")}\n   Run: bun run --cwd apps/shopify gen:stage`
    );
    process.exit(1);
}

console.log(
    `✅ Shopify stage artifacts on the production table — ${relative(LISTENER_PATH)} + ${relative(STAGE_MODULE_PATH)}`
);

#!/usr/bin/env bun
import { resolve } from "node:path";

const runner = resolve(import.meta.dir, "../../../tla/check.ts");
const model = resolve(import.meta.dir, "../model");
const child = Bun.spawnSync(["bun", runner, model, ...process.argv.slice(2)], {
    stdio: ["inherit", "inherit", "inherit"],
});
process.exit(child.exitCode ?? 1);

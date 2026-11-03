#!/usr/bin/env bun
/**
 * Screenshots demo steps for visual review, from a throwaway vite dev server.
 *
 *   bun run snap                                  # every step, phone, fr
 *   bun run snap -- --steps referrer.product,referrer.cart --lang en
 *   bun run snap -- --desk --out /tmp/desk        # 1440×900 with the phone frame
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { STEP_IDS } from "../src/core/stepIds.ts";

const { values } = parseArgs({
    options: {
        steps: { type: "string" },
        lang: { type: "string", default: "fr" },
        out: { type: "string", default: "/tmp/referral-demo-snaps" },
        desk: { type: "boolean", default: false },
        wait: { type: "string", default: "1800" },
    },
});

const root = resolve(import.meta.dirname, "..");
const out = resolve(values.out);
const wanted = values.steps?.split(",").map((s) => s.trim()) ?? [...STEP_IDS];
const unknown = wanted.filter(
    (id) => !(STEP_IDS as readonly string[]).includes(id)
);
if (unknown.length) throw new Error(`Unknown steps: ${unknown.join(", ")}`);

mkdirSync(out, { recursive: true });

const server = await createServer({
    root,
    configFile: join(root, "vite.config.ts"),
    server: { port: 0, host: "127.0.0.1" },
    logLevel: "error",
});
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error("vite did not report a local URL");

const browser = await chromium.launch();
const context = await browser.newContext(
    values.desk
        ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
        : {
              viewport: { width: 402, height: 874 },
              deviceScaleFactor: 2,
              isMobile: true,
              hasTouch: true,
          }
);

try {
    for (const stepId of wanted) {
        const page = await context.newPage();
        await page.addInitScript(
            ([state]) => localStorage.setItem("frak-referral-demo", state),
            [
                JSON.stringify({
                    state: {
                        stepId,
                        lang: values.lang,
                        frame: values.desk ? "on" : "off",
                    },
                    version: 1,
                }),
            ]
        );
        await page.goto(url);
        await page.waitForTimeout(Number(values.wait));
        const file = join(out, `${stepId}.${values.lang}.png`);
        await page.screenshot({ path: file });
        console.log(file);
        await page.close();
    }
} finally {
    await browser.close();
    await server.close();
}

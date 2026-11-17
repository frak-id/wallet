// split-words: visits every main page and fails if the layout breaks an ordinary word mid-word (see scripts/split-words.js).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const detector = readFileSync(join(here, "../scripts/split-words.js"), "utf8");

const pages = (m) => [
    `/m/${m}/dashboard`,
    `/m/${m}/campaigns`,
    `/m/${m}/campaigns/list`,
    `/m/${m}/campaigns/draft/new`,
    ...[
        "",
        "goals",
        "territory",
        "budget",
        "reward",
        "referral-chain",
        "validation",
    ].map((s) => `/m/${m}/campaigns/draft/camp_003/${s}`),
    `/m/${m}/members`,
    `/m/${m}/push`,
    `/m/${m}/merchant`,
    `/m/${m}/merchant/customize`,
    `/m/${m}/merchant/setup-status`,
    "/settings",
    "/settings/billing",
];

export default async ({ page, merchantId, step }) => {
    const found = [];
    for (const path of pages(merchantId)) {
        await page.goto(path);
        await page.waitForLoadState("load");
        await page.waitForTimeout(1500);
        await page.addScriptTag({ content: detector });
        const splits = await page.evaluate(() => window.__splitWords());
        for (const s of splits) found.push({ page: path, ...s });
        if (splits.some((s) => s.cls === "word"))
            await step(path.split("/").filter(Boolean).slice(-2).join("-"));
    }
    writeFileSync(
        join(process.env.EVIDENCE_DIR, "split-words.json"),
        JSON.stringify(found, null, 2)
    );
    const words = found.filter((f) => f.cls === "word");
    if (words.length) {
        const lines = words.map(
            (w) => `${w.page}: "${w.word}" (${w.at}) in ${w.path}`
        );
        throw new Error(
            `${words.length} word(s) broken mid-word:\n${[...new Set(lines)].slice(0, 30).join("\n")}`
        );
    }
};

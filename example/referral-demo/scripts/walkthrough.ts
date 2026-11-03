#!/usr/bin/env bun
/**
 * Plays the whole demo like a presenter: clean storage, then only on-screen taps.
 *
 *   bun scripts/walkthrough.ts                    # fr, phone
 *   bun scripts/walkthrough.ts --lang en --desk --out /tmp/walk-desk-en
 *   bun scripts/walkthrough.ts --from referee.intro   # resume past a known blocker
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Locator, type Page } from "@playwright/test";
import { createServer } from "vite";
import {
    isStepId,
    STEP_IDS,
    type StepId,
    stepIndex,
} from "../src/core/stepIds.ts";
import { merchant, products } from "../src/data/merchant.ts";
import { personas } from "../src/data/personas.ts";
import { campaign } from "../src/data/rewards.ts";
import { formatMoney } from "../src/i18n/format.ts";
import { interpolate, type Lang } from "../src/i18n/index.ts";
import { shellMessages } from "../src/shell/messages.ts";
import { stageMessages } from "../src/stage/messages.ts";
import { merchantMessages } from "../src/surfaces/merchant/messages.ts";
import {
    instagramMessages,
    shareSheetMessages,
    sharingMessages,
} from "../src/surfaces/social/messages.ts";
import { walletMessages } from "../src/surfaces/wallet/messages.ts";

const { values } = parseArgs({
    options: {
        lang: { type: "string", default: "fr" },
        out: { type: "string", default: "/tmp/referral-demo-walkthrough" },
        desk: { type: "boolean", default: false },
        from: { type: "string", default: "home" },
    },
});

if (values.lang !== "fr" && values.lang !== "en") {
    throw new Error(`--lang must be fr or en, got ${values.lang}`);
}
const lang: Lang = values.lang;
if (!isStepId(values.from)) throw new Error(`Unknown step: ${values.from}`);
const fromIndex = stepIndex(values.from);
const device = values.desk ? "desk" : "phone";
const out = resolve(values.out);
const STORAGE_KEY = "frak-referral-demo";
const SETTLE_MS = 1500;
const STEP_TIMEOUT_MS = 8000;

const stage = stageMessages[lang];
const shell = shellMessages[lang];
const shop = merchantMessages[lang];
const sharing = sharingMessages[lang];
const shareSheet = shareSheetMessages[lang];
const instagram = instagramMessages[lang];
const wallet = walletMessages[lang];

const say = interpolate;
/** The fixed text before a template's first placeholder. */
const lead = (template: string) => template.split("{")[0]?.trim() ?? "";
const reward = (amount: number) => formatMoney(amount, lang, "reward");
const button = (ui: Locator, name: string, exact = false) =>
    ui.getByRole("button", { name, exact });
const passkeyContinue = (ui: Locator, persona: "lea" | "chloe") =>
    button(
        ui.getByRole("dialog", {
            name: say(wallet["passkey.title"], {
                name: personas[persona].firstName,
            }),
        }),
        wallet["passkey.continue"],
        true
    );

type Tap = (ui: Locator) => Locator;
/** A target that pulses while idle never passes Playwright's stability check. */
type PulsingTap = { pulsing: Tap };

/** What the presenter taps on each step; the last tap (or a timer) moves to the next step. */
const script: {
    step: StepId;
    taps: (Tap | PulsingTap)[];
    timeout?: number;
}[] = [
    {
        step: "home",
        taps: [(ui) => button(ui, stage["launcher.referrer.title"])],
    },
    {
        step: "referrer.intro",
        taps: [(ui) => button(ui, stage["intro.start"], true)],
    },
    {
        step: "referrer.storeHome",
        taps: [(ui) => button(ui, products.serum.name[lang])],
    },
    {
        step: "referrer.product",
        taps: [
            (ui) =>
                button(
                    ui,
                    say(shop["product.addToCart"], {
                        price: formatMoney(products.serum.price, lang),
                    })
                ),
            (ui) => button(ui, lead(shop["product.viewCart"])),
        ],
    },
    {
        step: "referrer.cart",
        taps: [(ui) => button(ui, shop["cart.checkout"])],
    },
    {
        step: "referrer.checkout",
        taps: [(ui) => button(ui, shop["applePay.pay"])],
        timeout: 12_000,
    },
    {
        step: "referrer.thankYou",
        taps: [
            (ui) =>
                button(
                    ui,
                    say(shop["card.share.cta"], {
                        reward: reward(campaign.referrerReward),
                    })
                ),
        ],
    },
    {
        step: "referrer.sharing",
        taps: [(ui) => button(ui, sharing.share, true)],
    },
    {
        step: "referrer.shareSheet",
        taps: [
            (ui) => button(ui, shareSheet.instagram, true),
            (ui) => button(ui, shareSheet.igStoryHint),
        ],
    },
    {
        step: "referrer.storyComposer",
        taps: [(ui) => button(ui, instagram.yourStory)],
    },
    {
        step: "referrer.thankYouShared",
        taps: [(ui) => button(ui, shop["card.collect.cta"])],
    },
    {
        step: "referrer.install",
        taps: [
            (ui) => button(ui, wallet["install.download"]),
            (ui) => button(ui, wallet["appStore.get"], true),
            (ui) => button(ui, wallet["appStore.open"], true),
        ],
        timeout: 12_000,
    },
    {
        step: "referrer.onboarding",
        taps: [
            (ui) => button(ui, wallet["onboarding.start"], true),
            (ui) => button(ui, wallet["onboarding.continue"], true),
            (ui) => button(ui, wallet["onboarding.activate"]),
        ],
    },
    {
        step: "referrer.passkey",
        taps: [(ui) => passkeyContinue(ui, "lea")],
    },
    {
        step: "referrer.wallet",
        taps: [(ui) => button(ui, shell["continue.referrer"])],
    },
    {
        step: "referee.intro",
        taps: [(ui) => button(ui, stage["intro.start"], true)],
    },
    {
        step: "referee.feed",
        taps: [(ui) => button(ui, personas.lea.handle)],
    },
    {
        step: "referee.story",
        taps: [
            { pulsing: (ui) => button(ui, merchant.domain) },
            (ui) => button(ui, instagram.seeLink),
        ],
    },
    {
        step: "referee.landing",
        taps: [(ui) => button(ui, shop["applePay.buy"])],
    },
    { step: "referee.checkout", taps: [], timeout: 12_000 },
    {
        step: "referee.thankYou",
        taps: [
            (ui) =>
                button(
                    ui,
                    say(shop["card.referee.cta"], {
                        reward: reward(campaign.refereeReward),
                    })
                ),
        ],
    },
    {
        step: "referee.claim",
        taps: [
            (ui) => button(ui, wallet["claim.cta"]),
            (ui) => passkeyContinue(ui, "chloe"),
        ],
    },
    {
        step: "referee.wallet",
        taps: [
            (ui) => button(ui, wallet["pendingGains.confirm"]),
            (ui) => button(ui, shell["continue.referee"]),
        ],
    },
    { step: "finale", taps: [] },
];

const scripted = script.map((entry) => entry.step);
if (scripted.join() !== STEP_IDS.join()) {
    throw new Error("The walkthrough script no longer matches STEP_IDS");
}

/** A clean storage has nothing persisted yet: that is the launcher. */
const readStep = (page: Page) =>
    page.evaluate(
        (key) =>
            JSON.parse(localStorage.getItem(key) ?? "null")?.state?.stepId ??
            "home",
        STORAGE_KEY
    );

async function waitForStep(page: Page, step: StepId, timeout: number) {
    try {
        await page.waitForFunction(
            ([key, expected]) =>
                (JSON.parse(localStorage.getItem(key) ?? "null")?.state
                    ?.stepId ?? "home") === expected,
            [STORAGE_KEY, step],
            { timeout, polling: 100 }
        );
    } catch {
        const shot = join(out, `stuck-before-${step}.${lang}.${device}.png`);
        await page.screenshot({ path: shot });
        throw new Error(
            `Stuck on "${await readStep(page)}" waiting for "${step}" (${shot})`
        );
    }
}

/** Every step id the store persisted, in order, without repeats. */
const visited: string[] = [STEP_IDS[fromIndex] ?? "home"];
const problems: string[] = [];

function assertNoSkip(upTo: number) {
    const expected = STEP_IDS.slice(fromIndex, upTo + 1).join(" → ");
    if (visited.join(" → ") !== expected) {
        throw new Error(
            `Step sequence diverged:\n  got      ${visited.join(" → ")}\n  expected ${expected}`
        );
    }
}

/** What `force` skips: the target is visible and nothing covers its centre. */
async function assertOnTop(target: Locator) {
    await target.waitFor({ state: "visible", timeout: 10_000 });
    const onTop = await target.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2
        );
        return element.contains(hit);
    });
    if (!onTop) throw new Error("covered by another element");
}

mkdirSync(out, { recursive: true });

const root = resolve(import.meta.dirname, "..");
const server = await createServer({
    root,
    configFile: join(root, "vite.config.ts"),
    server: { port: 0, host: "127.0.0.1" },
    logLevel: "error",
});
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error("vite did not report a local URL");
const origin = new URL(url).origin;

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
    const page = await context.newPage();
    page.on("console", (message) => {
        if (message.type() === "error") {
            problems.push(`console.error: ${message.text()}`);
        }
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error}`));
    page.on("requestfailed", (request) =>
        problems.push(`request failed: ${request.url()}`)
    );
    page.on("request", (request) => {
        const target = request.url();
        if (target.startsWith("http") && !target.startsWith(origin)) {
            problems.push(`network outside the demo: ${target}`);
        }
    });
    await page.exposeFunction("__reportStep", (step: string) => {
        if (visited.at(-1) !== step) visited.push(step);
    });
    await page.addInitScript((key) => {
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name: string, value: string) {
            setItem.call(this, name, value);
            if (name !== key) return;
            const step = JSON.parse(value)?.state?.stepId;
            const report = Reflect.get(window, "__reportStep");
            if (step && typeof report === "function") report(step);
        };
    }, STORAGE_KEY);
    if (fromIndex > 0) {
        await page.addInitScript(
            ([key, state]) => {
                if (!localStorage.getItem(key))
                    localStorage.setItem(key, state);
            },
            [
                STORAGE_KEY,
                JSON.stringify({
                    state: { stepId: values.from, lang, frame: "auto" },
                    version: 1,
                }),
            ]
        );
    }

    await page.goto(url);
    // The desk's presenter panel sits outside <main>; never tap it.
    const ui = values.desk
        ? page.locator("main").first()
        : page.locator("body");
    const press = async (target: Locator, pulsing: boolean) => {
        if (pulsing) await assertOnTop(target);
        const options = { force: pulsing, timeout: 10_000 };
        await (values.desk ? target.click(options) : target.tap(options));
    };

    if (lang === "en" && fromIndex === 0) {
        await press(button(ui, "EN", true), false);
    }

    for (const [index, { step, taps, timeout }] of script.entries()) {
        if (index < fromIndex) continue;
        await waitForStep(page, step, timeout ?? STEP_TIMEOUT_MS);
        await page.waitForTimeout(SETTLE_MS);
        assertNoSkip(index);
        const shot = `${String(index).padStart(2, "0")}-${step}`;
        await page.screenshot({
            path: join(out, `${shot}.${lang}.${device}.png`),
        });
        console.log(`✓ ${step}`);

        for (const [tapIndex, tap] of taps.entries()) {
            const pulsing = typeof tap !== "function";
            const target = pulsing ? tap.pulsing(ui) : tap(ui);
            try {
                await press(target, pulsing);
            } catch (error) {
                await page.screenshot({
                    path: join(
                        out,
                        `unreachable-${shot}.${lang}.${device}.png`
                    ),
                });
                throw new Error(`Cannot tap ${target} on "${step}": ${error}`);
            }
            await page.waitForTimeout(700);
            if ((await readStep(page)) === step) {
                await page.screenshot({
                    path: join(
                        out,
                        `${shot}-tap${tapIndex + 1}.${lang}.${device}.png`
                    ),
                });
            }
        }
    }
    await page.waitForTimeout(SETTLE_MS);
    assertNoSkip(STEP_IDS.length - 1);
} finally {
    await browser.close();
    await server.close();
    if (problems.length)
        console.error(`Runtime problems:\n  ${problems.join("\n  ")}`);
}

if (problems.length) throw new Error(`${problems.length} runtime problem(s)`);
console.log(
    `Walked ${STEP_IDS.length - fromIndex} steps from ${values.from} (${lang}, ${device}) → ${out}`
);

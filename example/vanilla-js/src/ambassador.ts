import type { FrakClient } from "@frak-labs/core-sdk";
import { getEnvironment, sdkConfigStore } from "@frak-labs/core-sdk";
import {
    displaySharingPage,
    getMerchantInformation,
} from "@frak-labs/core-sdk/actions";
import {
    applyRewardPlaceholder,
    selectBestReward,
} from "@frak-labs/core-sdk/rewards";

/**
 * Wires the three ambassador page directions to the real SDK. The page
 * structure stays in HTML; only the reward figure, the share call and the
 * install URL come from the SDK — the split the merchant templates assume.
 */

const PLACEMENT = "ambassador";

/** `--text-primary__pbq4ak0` → `--frak-text-primary`, for one `:root` rule. */
function collectRule(rule: CSSRule, into: Map<string, string>) {
    if (!(rule instanceof CSSStyleRule)) return;
    if (!rule.selectorText.includes(":root")) return;

    for (const prop of Array.from(rule.style)) {
        const named = /^--([a-z]+-[A-Za-z0-9]+)__/.exec(prop);
        if (!named) continue;
        into.set(
            `--frak-${named[1]}`,
            rule.style.getPropertyValue(prop).trim()
        );
    }
}

function collectFrakTokens(): Map<string, string> {
    const tokens = new Map<string, string>();
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules)) {
                collectRule(rule, tokens);
            }
        } catch {
            // Cross-origin sheet: unreadable, and never ours.
        }
    }
    return tokens;
}

/**
 * Re-expose the design-system tokens the SDK injects, under stable names.
 * Vanilla-extract hashes the originals, so a page cannot reference them
 * directly without breaking on the next build.
 */
function adoptFrakTokens(): number {
    const tokens = collectFrakTokens();
    for (const [name, value] of tokens) {
        document.documentElement.style.setProperty(name, value);
    }
    return tokens.size;
}

const NAV_PAGES: [string, string][] = [
    ["a", "A · Gains"],
    ["b", "B · Le club"],
    ["c", "C · Mon lien"],
    ["d", "D · Le cadeau"],
    ["f", "F · Remboursé"],
    ["h", "H · Objections"],
    ["j", "J · Le vrai chiffre"],
];

/** Demo chrome only: one list for every direction, current one marked. */
function renderNav() {
    const host = document.querySelector("[data-frak-nav]");
    if (!host) return;

    const current = window.location.pathname.split("/").pop() || "index.html";

    const title = document.createElement("strong");
    title.textContent = "Direction :";
    host.append(title);

    const entries: [string, string][] = [
        ...NAV_PAGES.map(
            ([letter, label]) =>
                [`ambassador-${letter}.html`, label] as [string, string]
        ),
        ["index.html", "← Index"],
    ];
    for (const [file, label] of entries) {
        const link = document.createElement("a");
        link.href = file;
        link.textContent = label;
        if (file === current) link.className = "on";
        host.append(link);
    }

    const slot = document.createElement("span");
    slot.className = "sp";
    slot.dataset.frakStatus = "";
    slot.textContent = "SDK : démarrage…";
    host.append(slot);
}

function status(message: string) {
    const el = document.querySelector("[data-frak-status]");
    if (el) el.textContent = message;
}

function waitForClient(): Promise<FrakClient> {
    if (window.FrakSetup?.client) {
        return Promise.resolve(window.FrakSetup.client);
    }
    return new Promise((resolve) => {
        const onClient = () => {
            const client = window.FrakSetup?.client;
            if (!client) return;
            window.removeEventListener("frak:client", onClient);
            resolve(client);
        };
        window.addEventListener("frak:client", onClient);
    });
}

/**
 * Same selection `useReward` performs: best live referral reward for the
 * referrer side. Percentage payouts carry no amount to advertise, so they
 * resolve as no-reward and the page keeps its built-in wording.
 */
async function resolveReward(client: FrakClient): Promise<string | undefined> {
    try {
        const merchantInfo = await getMerchantInformation(client);
        const best = selectBestReward(merchantInfo.rewards, {
            currency: client.config.metadata?.currency,
            targetInteraction: "referral",
            audience: "referrer",
        });
        if (best && best.payoutType !== "percentage") return best.formatted;
    } catch {
        // Reward text is non-critical — the page renders without it.
    }
    return undefined;
}

/**
 * `data-frak-reward` with no value swaps the element text for the amount;
 * with a value it is a template carrying `{REWARD}`. The markup already
 * holds a readable fallback, so a failed lookup changes nothing.
 */
function applyReward(reward: string | undefined) {
    const targets =
        document.querySelectorAll<HTMLElement>("[data-frak-reward]");
    for (const el of targets) {
        const template = el.dataset.frakReward?.trim() || "{REWARD}";
        if (!reward) continue;
        el.textContent = applyRewardPlaceholder(template, reward);
    }
}

function bindShare(client: FrakClient) {
    const buttons = document.querySelectorAll<HTMLElement>("[data-frak-share]");
    for (const button of buttons) {
        button.removeAttribute("disabled");
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            try {
                await displaySharingPage(client, {}, PLACEMENT);
            } catch (error) {
                status(`Partage : ${error}`);
            }
        });
    }
}

/**
 * Uncredentialed on purpose: `getInstallUrl` would add `&a=`/`#p=` so the
 * install is attributed, which measures nothing on a demo and would drag a
 * new core-sdk export along. The destination is the same real page.
 */
function bindInstall(merchantId: string | undefined) {
    const badges = document.querySelectorAll<HTMLAnchorElement>(
        "[data-frak-install]"
    );
    if (!badges.length || !merchantId) return;

    const url = `${getEnvironment().wallet}/install?m=${encodeURIComponent(merchantId)}`;
    for (const badge of badges) {
        badge.href = url;
        badge.removeAttribute("aria-disabled");
    }
}

async function init() {
    status("SDK : en attente du client…");
    const client = await waitForClient();

    // Base CSS lands with the loader, so the tokens exist by the time a
    // client does.
    const tokens = adoptFrakTokens();

    const merchantId =
        sdkConfigStore.getMerchantId() ??
        (await sdkConfigStore.resolveMerchantId());

    bindShare(client);
    bindInstall(merchantId);

    const reward = await resolveReward(client);
    applyReward(reward);

    status(
        `SDK prêt · marchand ${merchantId ?? "non résolu"} · récompense ${reward ?? "non résolue"} · ${tokens} tokens`
    );
}

renderNav();
void init();

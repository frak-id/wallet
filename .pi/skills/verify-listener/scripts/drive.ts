/**
 * One flow in a fresh headless Chromium: boot the SDK on the merchant page,
 * then prove the flow's UI. Throws on failure; the caller writes evidence.
 */
import { join } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { STUB_WALLET } from "./server.ts";

export const FLOWS = ["boot", "modal-login", "sharing"] as const;
export type Flow = (typeof FLOWS)[number];

export type DriveResult = {
    consoleLines: string[];
    browserFailures: string[];
};

// Passkey mock: navigator.credentials.get answers with a real P-256 assertion
// signed by a per-page WebCrypto key (ox parses the DER signature; the stubbed
// backend never verifies it). Runs in every frame, including the listener.
const PASSKEY_MOCK = `(() => {
    const keyPair = crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
    const derInt = (b) => {
        let i = 0;
        while (i < b.length - 1 && b[i] === 0) i++;
        b = b.slice(i);
        return b[0] & 0x80 ? [0x02, b.length + 1, 0, ...b] : [0x02, b.length, ...b];
    };
    navigator.credentials.get = async (options) => {
        const pk = options?.publicKey;
        if (!pk?.challenge) throw new Error("No challenge found");
        window.__verifyListenerPasskeyCalls = (window.__verifyListenerPasskeyCalls ?? 0) + 1;
        const rawId = pk.allowCredentials?.[0]?.id ?? new Uint8Array(32).fill(7);
        const clientDataJSON = new TextEncoder().encode(JSON.stringify({
            type: "webauthn.get",
            challenge: b64u(pk.challenge),
            origin: location.origin,
            crossOrigin: false,
        }));
        const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pk.rpId ?? location.hostname)));
        const authenticatorData = new Uint8Array([...rpIdHash, 0x05, 0, 0, 0, 1]);
        const clientHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataJSON));
        const rs = new Uint8Array(await crypto.subtle.sign(
            { name: "ECDSA", hash: "SHA-256" },
            (await keyPair).privateKey,
            new Uint8Array([...authenticatorData, ...clientHash]),
        ));
        const r = derInt(rs.slice(0, 32)), s = derInt(rs.slice(32));
        const signature = new Uint8Array([0x30, r.length + s.length, ...r, ...s]);
        return {
            id: b64u(rawId),
            rawId: new Uint8Array(rawId).buffer,
            type: "public-key",
            authenticatorAttachment: "platform",
            response: { clientDataJSON: clientDataJSON.buffer, authenticatorData: authenticatorData.buffer, signature: signature.buffer, userHandle: null },
            getClientExtensionResults: () => ({}),
        };
    };
})();`;

type FrakWindow = {
    FrakSetup?: {
        client?: {
            waitForConnection: Promise<unknown>;
            waitForSetup: Promise<unknown>;
        };
        core?: Record<string, (...args: unknown[]) => Promise<unknown>>;
    };
    __verifyListenerResult?: Promise<{ ok: unknown } | { error: string }>;
};

/** Boot the SDK: client exposed, then RPC connection + setup handshake done. */
async function boot(page: Page, merchantUrl: string) {
    await page.goto(`${merchantUrl}/`, { waitUntil: "domcontentloaded" });
    // setupClient only exposes the client after the handshake (30 s deadline).
    await page.waitForFunction(
        () => Boolean((window as unknown as FrakWindow).FrakSetup?.client),
        null,
        { timeout: 35_000 }
    );
    await page.evaluate(async () => {
        const client = (window as unknown as FrakWindow).FrakSetup?.client;
        if (!client) throw new Error("FrakSetup.client missing");
        await Promise.all([client.waitForConnection, client.waitForSetup]);
    });
}

/** Wait out finite animations, then freeze looping ones, in this frame and the listener's. */
async function settle(page: Page) {
    const quiet = () =>
        (async () => {
            for (let calm = 0; calm < 3; ) {
                const running = document
                    .getAnimations()
                    .filter(
                        (a) =>
                            a.effect?.getComputedTiming().endTime !==
                            Number.POSITIVE_INFINITY
                    );
                if (running.length === 0) calm++;
                else calm = 0;
                await Promise.all(
                    running.map((a) => a.finished.catch(() => {}))
                );
                await new Promise((r) => requestAnimationFrame(() => r(null)));
            }
            // Looping animations (shimmers) never finish: pin them to their first frame.
            for (const a of document.getAnimations()) {
                if (
                    a.effect?.getComputedTiming().endTime !==
                    Number.POSITIVE_INFINITY
                )
                    continue;
                a.pause();
                a.currentTime = 0;
            }
        })();
    await page.evaluate(quiet);
    await page.frameLocator("#frak-wallet").locator("html").evaluate(quiet);
}

/** Call a FrakSetup.core action and park its promise on window for later. */
function fire(page: Page, action: string, args: unknown[]) {
    return page.evaluate(
        ({ action, args }) => {
            const w = window as unknown as FrakWindow;
            const client = w.FrakSetup?.client;
            const run = w.FrakSetup?.core?.[action];
            if (!client || !run) throw new Error(`FrakSetup.${action} missing`);
            w.__verifyListenerResult = run(client, ...args).then(
                (ok) => ({ ok }),
                (e: unknown) => ({ error: String((e as Error)?.message ?? e) })
            );
        },
        { action, args }
    );
}

type FlowCtx = {
    page: Page;
    result: DriveResult;
    shot: (name: string) => Promise<void>;
    onUiShown: () => void;
};

async function modalLogin({ page, shot, onUiShown }: FlowCtx) {
    const iframe = page.frameLocator("#frak-wallet");
    // No re-fire: a merchant gets one displayModal, so a dropped open must fail.
    await fire(page, "displayModal", [
        { steps: { login: { allowSso: false } }, metadata: {} },
    ]);
    await iframe
        .locator("body")
        .waitFor({ state: "visible", timeout: 15_000 })
        .catch(() => {
            throw new Error("modal never opened");
        });
    const primary = iframe.locator(".nexus-modal-button-primary").first();
    await primary.waitFor({ state: "visible", timeout: 10_000 });
    await shot("01-modal-login-step");
    await primary.click();
    const outcome = await page
        .waitForFunction(
            () => (window as unknown as FrakWindow).__verifyListenerResult,
            undefined,
            { timeout: 15_000 }
        )
        .then(
            (handle) => handle.jsonValue(),
            () => {
                throw new Error("modal login never resolved");
            }
        );
    const wallet = (outcome as { ok?: { login?: { wallet?: string } } })?.ok
        ?.login?.wallet;
    if (wallet?.toLowerCase() !== STUB_WALLET) {
        throw new Error(`modal login result: ${JSON.stringify(outcome)}`);
    }
    const calls = await iframe
        .locator("html")
        .evaluate(
            () =>
                (window as unknown as { __verifyListenerPasskeyCalls?: number })
                    .__verifyListenerPasskeyCalls ?? 0
        );
    if (calls < 1) throw new Error("login resolved without a passkey call");
    onUiShown();
    await shot("02-modal-login-done");
}

async function sharing({ page, shot, onUiShown }: FlowCtx) {
    await fire(page, "displaySharingPage", [
        { products: [{ title: "verify-listener product" }] },
    ]);
    // The copy CTA always renders; the native share button needs navigator.share.
    const cta = page
        .frameLocator("#frak-wallet")
        .locator('[data-testid="sharing-copy"]');
    await cta.waitFor({ state: "visible", timeout: 20_000 });
    onUiShown();
    await shot("01-sharing-cta");
}

export async function driveFlow(opts: {
    browser: Browser;
    flow: Flow;
    merchantUrl: string;
    walletUrl: string;
    evidenceDir: string;
    /** Filled as the run goes, so it survives a thrown failure. */
    result: DriveResult;
    /** Called the moment the flow's UI is proven, to cut the request list. */
    onUiShown: () => void;
}): Promise<void> {
    const {
        browser,
        flow,
        merchantUrl,
        walletUrl,
        evidenceDir,
        result,
        onUiShown,
    } = opts;
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: "en-US",
    });
    // Hermetic. Analytics is answered 200 {}. Any other off-origin call (the
    // listener's build-time backend, e.g. https://localhost:3030) is replayed
    // against the harness stubs, which 404 what they do not know.
    await context.route("**/*", async (route) => {
        const u = new URL(route.request().url());
        if (u.origin === merchantUrl || u.origin === walletUrl)
            return route.continue();
        if (u.pathname === "/track") {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: "{}",
            });
        }
        const response = await route.fetch({
            url: `${walletUrl}${u.pathname}${u.search}`,
            headers: {
                ...route.request().headers(),
                "x-verify-original-origin": u.origin,
            },
        });
        return route.fulfill({ response });
    });
    await context.addInitScript(PASSKEY_MOCK);
    const page = await context.newPage();
    page.on("console", (m) =>
        result.consoleLines.push(`[${m.type()}] ${m.text()}`)
    );
    page.on("pageerror", (e) => result.consoleLines.push(`[pageerror] ${e}`));
    page.on("requestfailed", (r) =>
        result.browserFailures.push(
            `requestfailed ${r.url()} ${r.failure()?.errorText}`
        )
    );
    const shot = async (name: string) => {
        await settle(page);
        await page.screenshot({ path: join(evidenceDir, `${name}.png`) });
    };
    const ctx: FlowCtx = { page, result, shot, onUiShown };

    try {
        await boot(page, merchantUrl);
        if (flow === "boot") {
            onUiShown();
            await shot("01-boot");
        } else if (flow === "modal-login") {
            await modalLogin(ctx);
        } else {
            await sharing(ctx);
        }
    } catch (err) {
        await page
            .screenshot({ path: join(evidenceDir, "FAIL.png") })
            .catch(() => {});
        throw err;
    } finally {
        await context.close();
    }
}

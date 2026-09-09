import { request } from "@playwright/test";
import {
    TARGET_BACKEND_URL,
    TARGET_ENV,
    TARGET_HOST_URL,
} from "../../playwright.config";

type MerchantResolveResponse = {
    merchantId: string;
    domain: string;
    allowedDomains: string[];
};

async function probe(
    url: string,
    options: { timeout?: number } = {}
): Promise<{ status: number; body: string } | null> {
    const context = await request.newContext({ ignoreHTTPSErrors: true });
    try {
        const response = await context.get(url, {
            timeout: options.timeout ?? 10_000,
            failOnStatusCode: false,
        });
        return { status: response.status(), body: await response.text() };
    } catch {
        return null;
    } finally {
        await context.dispose();
    }
}

// `/health` answers `{status:"ok",uptime:"fresh"}` for ten minutes, then a
// hostname/stage body, then a plain-string 500 past a day. Only a transport
// failure means unreachable, so any HTTP status counts as up.
async function assertBackendReachable() {
    const health = await probe(`${TARGET_BACKEND_URL}/health`);
    if (health) return;
    throw new Error(
        `[sharing-referral] Backend unreachable at ${TARGET_BACKEND_URL}/health (TARGET_ENV=${TARGET_ENV}). ` +
            (TARGET_ENV === "local"
                ? "Start the SST multiplexer with `bun run dev` from the repo root."
                : "The deployed environment is down; a red suite here is not a regression.")
    );
}

async function assertHarnessReachable() {
    const harness = await probe(TARGET_HOST_URL);
    if (harness && harness.status < 400) return;
    throw new Error(
        `[sharing-referral] Merchant harness unreachable at ${TARGET_HOST_URL} (status ${harness?.status ?? "no response"}). ` +
            (TARGET_ENV === "local"
                ? "Start the vanilla harness manually in the SST multiplexer (`autostart: false` in infra/example.ts)."
                : "Set FRAK_E2E_HOST_URL to a reachable merchant page.")
    );
}

// The listener refuses `frak_sendInteraction` unless the iframe origin's host
// (port included) is in the merchant's `allowedDomains`, and both refusal
// layers swallow the error — the only observable is zero arrival requests.
async function assertMerchantTrustsHarness(): Promise<MerchantResolveResponse> {
    const harnessUrl = new URL(TARGET_HOST_URL);
    const resolveUrl = `${TARGET_BACKEND_URL}/user/merchant/resolve?domain=${encodeURIComponent(harnessUrl.hostname)}`;
    const resolved = await probe(resolveUrl);

    if (resolved?.status !== 200) {
        throw new Error(
            `[sharing-referral] No merchant resolves for "${harnessUrl.hostname}" (status ${resolved?.status ?? "no response"}) at ${resolveUrl}. ` +
                "The SDK looks the merchant up by bare hostname; register one for that domain."
        );
    }

    const merchant = JSON.parse(resolved.body) as MerchantResolveResponse;
    const originHost = harnessUrl.host.replace(/^www\./, "");
    const allowed = merchant.allowedDomains.map((d) => d.replace(/^www\./, ""));

    if (!allowed.includes(originHost)) {
        throw new Error(
            `[sharing-referral] Merchant ${merchant.merchantId} ("${merchant.domain}") does not trust origin "${originHost}". ` +
                `allowedDomains=${JSON.stringify(merchant.allowedDomains)}. ` +
                "The listener would run in dev-override and silently drop every arrival, so the suite would pass its negative assertions for the wrong reason. " +
                `Add "${originHost}" to that merchant's allowedDomains.`
        );
    }

    return merchant;
}

// `detectFrakEnv` probes http://localhost:3010 before https://localhost:3000,
// so a running Tauri dev server points the iframe at an origin holding no
// wallet session and every share link silently drops its `w` field.
async function assertNoTauriOriginConflict() {
    if (TARGET_ENV !== "local") return;
    const tauri = await probe("http://localhost:3010/favicon.ico", {
        timeout: 2_000,
    });
    if (!tauri) return;
    throw new Error(
        "[sharing-referral] A server is answering on http://localhost:3010. The harness would point the wallet iframe there instead of https://localhost:3000, " +
            "where it holds no session, so every share link loses its referrer. Stop the Tauri dev server."
    );
}

/**
 * Fail with one legible message naming the unmet environment precondition,
 * instead of an assertion timeout deep inside a spec.
 */
export async function assertStackReady(): Promise<MerchantResolveResponse> {
    await assertBackendReachable();
    await assertHarnessReachable();
    await assertNoTauriOriginConflict();
    return assertMerchantTrustsHarness();
}

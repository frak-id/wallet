import type { Page } from "@playwright/test";

export async function mockDefaultApiRoutes(page: Page, baseURL?: string) {
    await Promise.all([
        mockAnalytics(page),
        mockBackendAuth(page),
        mockBackendBalance(page),
        mockBackendNotifications(page),
        mockBackendMerchant(page),
        mockRemoteImages(page, baseURL),
        mockRpc(page),
        mockWebSocket(page),
    ]);
}

// 1x1 opaque PNG. Product and merchant art comes from merchant CDNs, and a
// visual suite that reaches the network is slow and non-deterministic.
const PIXEL = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII=",
    "base64"
);

const IMAGE_PATH = /\.(png|jpe?g|webp|avif|gif|svg)$/i;

async function mockRemoteImages(page: Page, baseURL?: string) {
    // Compared against the page's own origin, so first-party assets keep
    // rendering under every supported base URL.
    const appOrigin = baseURL ? new URL(baseURL).origin : null;

    await page.route(
        (url) => IMAGE_PATH.test(url.pathname) && url.origin !== appOrigin,
        (route) =>
            route.fulfill({
                status: 200,
                contentType: "image/png",
                body: PIXEL,
            })
    );
}

/** Merchant identity the sharing page renders when no `appName` overrides it. */
const merchantResolveFixture = {
    merchantId: "0x1234",
    productId: "0xabcd",
    name: "Acme Store",
    domain: "acme.example.com",
    allowedDomains: ["acme.example.com"],
    sdkConfig: {
        name: "Acme Store",
        currency: "eur",
        lang: "fr",
    },
} as const;

/** The referrer payout the sharing page renders; specs wait on this number. */
export const REFERRER_REWARD_EUR = 12;

const payout = (eur: number) => ({
    payoutType: "fixed",
    amount: { amount: eur, eurAmount: eur, usdAmount: eur, gbpAmount: eur },
});

/**
 * One live fixed-payout campaign. `conditions: []` keeps it started and
 * unexpired, so `selectBestReward` always returns it.
 */
const estimatedRewardsFixture = {
    rewards: [
        {
            campaignId: "camp-1",
            name: "Referral",
            interactionTypeKey: "purchase",
            conditions: [],
            referrer: payout(REFERRER_REWARD_EUR),
            referee: payout(REFERRER_REWARD_EUR / 2),
        },
    ],
} as const;

async function mockBackendMerchant(page: Page) {
    await page.route("**/*/user/merchant/resolve*", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(merchantResolveFixture),
        })
    );

    await page.route("**/*/user/merchant/estimated-rewards*", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(estimatedRewardsFixture),
        })
    );

    await page.route("**/*/user/merchant/referral-status*", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ status: "none" }),
        })
    );
}

async function mockAnalytics(page: Page) {
    await page.route("https://op-api.*/*", (route) =>
        route.fulfill({ status: 200, body: "{}" })
    );
}

async function mockBackendAuth(page: Page) {
    await page.route("**/*/wallet/auth/*", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        })
    );
}

async function mockBackendBalance(page: Page) {
    await page.route("**/*/wallet/balance", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                totalBalance: "1500000000000000000",
            }),
        })
    );

    await page.route("**/*/wallet/balance/claimable", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ claimableBalance: "0" }),
        })
    );

    await page.route("**/*/wallet/balance/pending", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ pendingBalance: "0" }),
        })
    );
}

async function mockBackendNotifications(page: Page) {
    await page.route("**/*/wallet/notifications/tokens/*", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ tokens: [] }),
        })
    );
}

async function mockRpc(page: Page) {
    await page.route(
        "https://erpc.gcp*.frak.id/nexus-rpc/evm/**/*",
        (route) => {
            const request = route.request();
            if (request.method() !== "POST") {
                return route.continue();
            }

            const body = request.postDataJSON() as
                | { id?: number; method?: string }
                | { id?: number; method?: string }[]
                | null;

            if (!body) return route.continue();

            const requests = Array.isArray(body) ? body : [body];
            const responses = requests.map((req) => ({
                jsonrpc: "2.0" as const,
                id: req.id,
                result: "0x0",
            }));

            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(
                    responses.length === 1 ? responses[0] : responses
                ),
            });
        }
    );
}

async function mockWebSocket(page: Page) {
    await page.routeWebSocket("**/*/ws*", (ws) => {
        ws.onMessage(() => {});
    });
}

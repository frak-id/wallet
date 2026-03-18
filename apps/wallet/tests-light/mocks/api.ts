import type { Page } from "@playwright/test";

export async function mockDefaultApiRoutes(page: Page) {
    await Promise.all([
        mockAnalytics(page),
        mockBackendAuth(page),
        mockBackendBalance(page),
        mockBackendNotifications(page),
        mockRpc(page),
        mockWebSocket(page),
    ]);
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

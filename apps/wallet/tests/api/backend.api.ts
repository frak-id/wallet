import type { Page, Route, WebSocketRoute } from "@playwright/test";

/** Wallet address returned by the mocked `/auth/login` endpoint. */
export const E2E_WALLET_ADDRESS =
    "0x1111111111111111111111111111111111111111" as const;

/**
 * Canned session payload the backend's `/auth/login` returns. Mirrors a
 * `WebAuthNWallet` session (+ `token`/`sdkJwt`) so `useLogin` hydrates without
 * a real backend round-trip.
 */
const DEFAULT_E2E_SESSION = {
    type: "webauthn",
    address: E2E_WALLET_ADDRESS,
    publicKey: {
        x: "0x1111111111111111111111111111111111111111111111111111111111111111",
        y: "0x2222222222222222222222222222222222222222222222222222222222222222",
    },
    authenticatorId: "playwright-e2e-authenticator",
    transports: ["internal"],
    token: "e2e-mock-wallet-token",
    sdkJwt: "e2e-mock-sdk-jwt",
};

export class BackendApi {
    constructor(private readonly page: Page) {}

    /**
     * Short-circuit WebAuthn login with a canned session so modal/auth specs
     * don't depend on real backend signature verification. Handles the
     * cross-origin (iframe → backend) preflight + CORS headers.
     */
    async mockLoginSuccess(
        session: Record<string, unknown> = DEFAULT_E2E_SESSION
    ) {
        await this.page.route("**/*/wallet/auth/login", async (route) => {
            const request = route.request();
            const headers = request.headers();
            const cors: Record<string, string> = {
                "access-control-allow-origin": headers.origin ?? "*",
                "access-control-allow-credentials": "true",
                "access-control-allow-methods": "POST, OPTIONS",
                "access-control-allow-headers":
                    headers["access-control-request-headers"] ??
                    "content-type, x-wallet-auth, x-wallet-sdk-auth, x-frak-client-id",
            };
            if (request.method() === "OPTIONS") {
                await route.fulfill({ status: 204, headers: cors });
                return;
            }
            await route.fulfill({
                status: 200,
                headers: { ...cors, "content-type": "application/json" },
                body: JSON.stringify(session),
            });
        });
    }

    async interceptAuthRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/wallet/auth/*", handler);
    }

    // Register endpoint only (unlike interceptAuthRoute, doesn't stub
    // emailStatus), so the onboarding email step can still complete.
    async interceptRegisterRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/wallet/auth/register", handler);
    }

    async interceptNotificationsRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/wallet/notifications/tokens/*", handler);
    }

    async interceptWebSocketRoute(handler: (route: WebSocketRoute) => void) {
        // Route at the context level: the wallet drives pairing from its
        // service worker, so the pairing socket is not a page-scoped socket
        // (page.routeWebSocket / page.on("websocket") never see it).
        await this.page.context().routeWebSocket("**/*/ws*", handler);
    }

    /**
     * Capture WebSocket frames by proxying the socket through
     * {@link interceptWebSocketRoute} (context-scoped, so the SW pairing
     * socket is covered). Register before the socket opens.
     */
    async interceptWebsocketAuthMessage({
        onClientMsg,
        onServerMsg,
    }: {
        onClientMsg?: (msg: string) => void;
        onServerMsg?: (msg: string) => void;
    }) {
        await this.interceptWebSocketRoute((ws) => {
            const server = ws.connectToServer();
            ws.onMessage((message) => {
                onClientMsg?.(message as string);
                server.send(message);
            });
            server.onMessage((message) => {
                onServerMsg?.(message as string);
                ws.send(message);
            });
        });
    }

    async interceptBalanceRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/wallet/balance", handler);
    }

    async interceptClaimableBalanceRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/wallet/balance/claimable", handler);
    }

    async interceptPendingBalanceRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/wallet/balance/pending", handler);
    }
}

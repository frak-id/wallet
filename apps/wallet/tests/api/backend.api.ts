import type { Page, Route, WebSocketRoute } from "@playwright/test";

export class BackendApi {
    constructor(private readonly page: Page) {}

    async interceptAuthRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/wallet/auth/*", handler);
    }

    async interceptNotificationsRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/wallet/notifications/tokens/*", handler);
    }

    async interceptWebSocketRoute(handler: (route: WebSocketRoute) => void) {
        await this.page.routeWebSocket("**/*/ws*", handler);
    }

    async interceptWebsocketAuthMessage({
        onClientMsg,
        onServerMsg,
    }: {
        onClientMsg?: (msg: string) => void;
        onServerMsg?: (msg: string) => void;
    }) {
        await this.interceptWebSocketRoute(async (ws) => {
            // Here you can handle the WebSocket route, e.g., log messages or modify them
            const server = ws.connectToServer();
            ws.onMessage((message) => {
                // Send msg to server
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

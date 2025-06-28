import type { Page, Route } from "@playwright/test";

export class AnalyticsApi {
    constructor(private readonly page: Page) {}

    async mockAnalyticsRoute() {
        await this.page.route("https://op-api.*/*", (route) =>
            route.fulfill({
                status: 200,
            })
        );
    }

    async interceptAnalyticsRoute(handler: (route: Route) => void) {
        await this.page.route("https://op-api.*/*", handler);
    }
}

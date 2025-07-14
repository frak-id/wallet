import type { Page, Route } from "@playwright/test";

export class BackendApi {
    constructor(private readonly page: Page) {}

    async interceptAuthRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/wallet/auth/*", handler);
    }
}

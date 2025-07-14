import type { Page } from "@playwright/test";

export class StorageHelper {
    constructor(private readonly page: Page) {}

    async clearStorage() {
        await this.page.evaluate(() => {
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch (error) {
                console.error("Error clearing storage", error);
            }
        });
    }
}

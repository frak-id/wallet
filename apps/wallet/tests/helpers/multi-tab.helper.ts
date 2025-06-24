import type { BrowserContext, Page } from "@playwright/test";

export class MultiTabHelper {
    constructor(private context: BrowserContext) {}

    async openNewTab(url: string): Promise<Page> {
        const newPage = await this.context.newPage();
        await newPage.goto(url);
        return newPage;
    }
}

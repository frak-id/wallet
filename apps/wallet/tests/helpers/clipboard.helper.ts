import { expect, type Page } from "@playwright/test";

export class ClipboardHelper {
    constructor(private readonly page: Page) {}

    // Copy handlers write async after the click resolves, so poll the read.
    async verifyClipboardNotEmpty() {
        await expect
            .poll(
                async () =>
                    (
                        await this.page.evaluate(() =>
                            navigator.clipboard.readText()
                        )
                    ).length,
                { timeout: 5_000 }
            )
            .toBeGreaterThan(0);
    }
}

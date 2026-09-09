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

    /**
     * The clipboard's current text, once something has been written to it.
     *
     * Same poll as above, but returning the content: a spec that only asserts
     * "not empty" cannot check what was actually copied.
     */
    async readText(): Promise<string> {
        let text = "";
        await expect
            .poll(
                async () => {
                    text = await this.page.evaluate(() =>
                        navigator.clipboard.readText()
                    );
                    return text.length;
                },
                { timeout: 5_000 }
            )
            .toBeGreaterThan(0);
        return text;
    }
}

import { type Page, expect } from "@playwright/test";

export class ClipboardHelper {
    constructor(private readonly page: Page) {}

    // Verify that some stuff are in the clipboard content
    async verifyClipboardNotEmpty() {
        // It's best to pass the expected value
        const clipboardText: string = await this.page.evaluate(() =>
            navigator.clipboard.readText()
        );
        //verify the clipboard is not empty
        expect(clipboardText).toBeDefined();
        expect(clipboardText).not.toHaveLength(0);
    }
}

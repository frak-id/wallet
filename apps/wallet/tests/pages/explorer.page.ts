import { expect, type Page } from "@playwright/test";

/**
 * ExplorerPage helper — drives the merchant list header + "Sort by" sheet.
 */
export class ExplorerPage {
    constructor(private readonly page: Page) {}

    async navigateToExplorer() {
        await this.page.goto("/explorer");
        await this.page.waitForURL("/explorer");
        await expect(
            this.page.getByRole("heading", { name: "Explorer", level: 1 })
        ).toBeVisible({ timeout: 10_000 });
    }

    private get applyButton() {
        return this.page.getByRole("button", { name: "Apply" });
    }

    async openSortSheet() {
        // Once a non-default sort is applied the header button announces it
        // ("Sort (Highest reward)"), so match the "Sort" prefix rather than an
        // exact label.
        await this.page.getByRole("button", { name: /^Sort/ }).click();
        await expect(this.applyButton).toBeVisible();
    }

    async selectSortOption(name: string) {
        await this.page.getByRole("radio", { name }).click();
    }

    async applySort() {
        await this.applyButton.click();
        await expect(this.applyButton).toBeHidden();
    }

    async verifySortOptionChecked(name: string) {
        await expect(this.page.getByRole("radio", { name })).toBeChecked();
    }

    /** First merchant name in list order — used to assert re-sorting. */
    private get firstMerchantName() {
        return this.page.getByText(/^Merchant (One|Two|Three)$/).first();
    }

    async verifyFirstMerchant(name: string) {
        await expect(this.firstMerchantName).toHaveText(name);
    }
}

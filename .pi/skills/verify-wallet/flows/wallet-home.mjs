// wallet-home: on a zero balance, each stat card opens its empty-state dialog, and "Discover offers" reaches the explorer.
const ZERO_BALANCE = {
    total: { amount: 0, eurAmount: 0, usdAmount: 0, gbpAmount: 0 },
    balances: [],
};
const DIALOGS = [
    ["€0 Pending", "You don't have any earnings yet"],
    ["€0 Lifetime", "You haven't transferred any earnings yet"],
    ["Transfer to my bank", "You don't have any money to transfer yet"],
];

export default async ({ page, url, step, expect }) => {
    await page.route("**/*/wallet/balance", (route) =>
        route.fulfill({ json: ZERO_BALANCE })
    );
    await page.goto(`${url}/wallet`, { waitUntil: "domcontentloaded" });
    await expect(
        page.getByRole("heading", { name: "Wallet", level: 1 })
    ).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Total balance€0.00");
    await expect(
        page.getByRole("heading", { name: "Earnings history", level: 2 })
    ).toBeVisible();
    await step("wallet");

    for (const [button, title] of DIALOGS) {
        await page.getByRole("button", { name: button, exact: true }).click();
        const dialog = page.getByRole("dialog", { name: title });
        await expect(dialog).toBeVisible();
        await step(
            `dialog-${button.replace(/\W+/g, "-").replace(/^-|-$/g, "").toLowerCase()}`
        );
        await dialog.getByRole("button", { name: "Close" }).click();
        await expect(dialog).toBeHidden();
    }

    await page.getByRole("link", { name: "Discover offers" }).click();
    await expect(page).toHaveURL(/\/explorer$/);
    await expect(
        page.getByRole("heading", { name: "Explorer", level: 1 })
    ).toBeVisible();
    await step("explorer");
};

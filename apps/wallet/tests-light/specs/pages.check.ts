import { expect, test } from "../fixtures";

test.describe("Wallet Dashboard", () => {
    test("should render the wallet page", async ({ page }) => {
        await page.goto("/wallet");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("wallet-dashboard.png", {
            animations: "disabled",
            fullPage: true,
        });
    });

    test("should render with zero balance", async ({ page }) => {
        await page.route("**/*/wallet/balance", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ totalBalance: "0" }),
            })
        );

        await page.goto("/wallet");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("wallet-zero-balance.png", {
            animations: "disabled",
            fullPage: true,
        });
    });
});

test.describe("Settings", () => {
    test("should render the settings page", async ({ page }) => {
        await page.goto("/profile");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("settings.png", {
            animations: "disabled",
            fullPage: true,
        });
    });
});

test.describe("History", () => {
    test("should render the history page", async ({ page }) => {
        await page.goto("/history");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("history.png", {
            animations: "disabled",
            fullPage: true,
        });
    });
});

test.describe("Tokens", () => {
    test("should render the receive page", async ({ page }) => {
        await page.goto("/tokens/receive");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("tokens-receive.png", {
            animations: "disabled",
            fullPage: true,
        });
    });

    test("should render the send page", async ({ page }) => {
        await page.goto("/tokens/send");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("tokens-send.png", {
            animations: "disabled",
            fullPage: true,
        });
    });
});

test.describe("Notifications", () => {
    test("should render the notifications page", async ({ page }) => {
        await page.goto("/notifications");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("notifications.png", {
            animations: "disabled",
            fullPage: true,
        });
    });
});

test.describe("Auth Pages (unauthenticated)", () => {
    test("should render the register page", async ({
        page,
        injectAuthState,
    }) => {
        await injectAuthState({ authenticated: false });
        await page.goto("/register");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("register.png", {
            animations: "disabled",
            fullPage: true,
        });
    });

    test("should render the login page", async ({ page, injectAuthState }) => {
        await injectAuthState({ authenticated: false });
        await page.goto("/login");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("login.png", {
            animations: "disabled",
            fullPage: true,
        });
    });
});

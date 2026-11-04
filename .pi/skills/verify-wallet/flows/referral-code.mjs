// referral-code: Profile → Referrals → create and redeem forms gate their submit button on input.
export default async ({ page, url, step, expect }) => {
    await page.goto(`${url}/profile`, { waitUntil: "domcontentloaded" });
    await expect(
        page.getByRole("heading", { name: "Profile", level: 1 })
    ).toBeVisible();
    await page.getByRole("link", { name: "Referrals" }).click();
    await expect(page).toHaveURL(/\/profile\/referral$/);
    await expect(
        page.getByRole("heading", { name: "Referrals", level: 1 })
    ).toBeVisible();
    await step("referrals");

    await page.getByRole("link", { name: "Generate my code" }).click();
    await expect(
        page.getByRole("heading", { name: "My referral code", level: 1 })
    ).toBeVisible();
    const generate = page.getByRole("button", { name: "Generate my code" });
    await expect(generate).toBeDisabled();
    await page
        .getByRole("textbox", { name: "Customize your code" })
        .fill("LOLA");
    await expect(generate).toBeEnabled();
    await step("create-filled");

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/profile\/referral$/);
    await page.getByRole("link", { name: "Enter a referral code" }).click();
    await expect(
        page.getByRole("heading", { name: "Got a referral code?", level: 1 })
    ).toBeVisible();
    const apply = page.getByRole("button", { name: "Apply the code" });
    await expect(apply).toBeDisabled();
    await page.getByRole("textbox", { name: "Referral code" }).fill("LOLA10");
    await expect(apply).toBeEnabled();
    await step("redeem-filled");
};

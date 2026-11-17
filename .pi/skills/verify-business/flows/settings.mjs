// settings: the header's demo badge opens Settings, and choosing French re-renders the app in French.
export default async ({ page, step, expect }) => {
    await page.getByRole("banner").getByRole("link", { name: "demo" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(
        page.getByRole("heading", { name: "Settings", level: 1 })
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "EUR" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "English" })).toBeChecked();
    await step("settings");

    await page.getByRole("radio", { name: "French" }).click();
    await expect(
        page.getByRole("heading", { name: "Paramètres", level: 1 })
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "Français" })).toBeChecked();
    await step("settings-fr");
};

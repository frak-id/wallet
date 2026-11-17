// draft-resume: a draft's detail sheet → "Edit campaign" reopens the wizard with its saved values, and Continue walks it to Budget & schedule.
import { openFromSidebar } from "./nav.mjs";

const STEPS = ["Goals", "Territory & categories", "Budget & schedule"];

export default async ({ page, step, expect }) => {
    await openFromSidebar(page, "/campaigns/list");
    await page.getByRole("tab", { name: "Draft" }).click();
    await page
        .getByRole("cell", {
            name: "Draft Campaign - Registration Focus",
            exact: true,
        })
        .click();
    const sheet = page.getByRole("dialog", {
        name: "Draft Campaign - Registration Focus",
    });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "Edit campaign" }).click();

    await expect(
        page.getByRole("heading", { name: "Campaign basics", level: 1 })
    ).toBeVisible();
    await expect(
        page.getByRole("textbox", { name: "Campaign title" })
    ).toHaveValue("Draft Campaign - Registration Focus");
    await step("basics");

    for (const heading of STEPS) {
        await page.getByRole("button", { name: "Continue" }).click();
        await expect(
            page.getByRole("heading", { name: heading, level: 1 })
        ).toBeVisible();
    }
    await expect(page).toHaveURL(/\/campaigns\/draft\/camp_003\/budget$/);
    await expect(page.getByRole("radio", { name: "Weekly" })).toBeChecked();
    await expect(
        page.getByRole("spinbutton", { name: "Budget cap" })
    ).toHaveValue("750");
    await step("budget");
};

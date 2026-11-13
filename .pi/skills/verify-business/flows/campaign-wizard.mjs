// campaign-wizard: from the sidebar's campaign list, "Create new campaign" opens basics, a title enables Continue, and Continue reaches Goals.
import { openFromSidebar } from "./nav.mjs";

export default async ({ page, step, expect }) => {
    await openFromSidebar(page, "/campaigns/list");
    await expect(
        page.getByRole("heading", { name: "List", level: 1 })
    ).toBeVisible();
    await page
        .getByRole("main")
        .getByRole("link", { name: "Create new campaign" })
        .click();

    await expect(
        page.getByRole("heading", { name: "Campaign basics", level: 1 })
    ).toBeVisible();
    const next = page.getByRole("button", { name: "Continue" });
    await expect(next).toBeDisabled();
    await page
        .getByRole("textbox", { name: "Campaign title" })
        .fill("Verify wizard");
    await expect(next).toBeEnabled();
    await step("basics-filled");

    await next.click();
    await expect(page).toHaveURL(/\/campaigns\/draft\/[^/]+\/goals$/);
    await expect(
        page.getByRole("heading", { name: "Goals", level: 1 })
    ).toBeVisible();
    await expect(
        page.getByRole("listitem", {
            name: "Step 1: Campaign basics, completed",
        })
    ).toBeVisible();
    await step("goals");
};

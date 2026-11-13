// campaigns-list: the status tabs and search filter the table, and a row opens the campaign's detail sheet.
import { openFromSidebar } from "./nav.mjs";

export default async ({ page, step, expect }) => {
    await openFromSidebar(page, "/campaigns/list");
    await expect(
        page.getByRole("heading", { name: "List", level: 1 })
    ).toBeVisible();
    const rows = page
        .getByRole("table")
        .getByRole("rowgroup")
        .nth(1)
        .getByRole("row");
    await expect(rows.first()).toBeVisible();
    const all = await rows.count();
    await step("list");

    await page.getByRole("tab", { name: "Draft" }).click();
    await expect(page.getByRole("tab", { name: "Draft" })).toHaveAttribute(
        "aria-selected",
        "true"
    );
    await expect(rows.first()).toContainText("Draft");
    for (const row of await rows.all())
        await expect(row).toContainText("Draft");
    await step("draft-tab");

    await page.getByRole("tab", { name: "All" }).click();
    await expect(rows).toHaveCount(all);
    await page.getByRole("textbox", { name: "Search" }).fill("Summer");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Summer Referral Campaign");
    await step("search");

    await rows
        .first()
        .getByRole("cell", { name: "Summer Referral Campaign", exact: true })
        .click();
    await expect(page).toHaveURL(/[?&]campaign=camp_001/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(
        "Summer Referral Campaign"
    );
    await step("details-sheet");
};

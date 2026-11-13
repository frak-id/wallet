// Below 768px Campaigns is a link to the list and its sub-items are hidden, so items are found by destination.
export async function openFromSidebar(page, pathSuffix) {
    const sidebar = page.getByRole("navigation").filter({
        has: page.locator('a[href$="/dashboard"]'),
    });
    await sidebar.waitFor();
    const link = sidebar.locator(`a[href$="${pathSuffix}"]:visible`).first();
    if (!(await link.count())) {
        await sidebar.getByRole("button", { name: "Campaigns" }).click();
    }
    await link.click();
}

// screens: renders every scenario, one screenshot each, and fails on a page error or an unexpected error page.
import { ERROR_BOUNDARY_ID, selectedScenarios } from "./scenarios.mjs";

export default async ({ page, open, step, expect, pageErrors }) => {
    const problems = [];
    for (const [name, path, scenario] of selectedScenarios()) {
        const before = pageErrors.length;
        await open(path, scenario);
        const errorPage = page.getByText(ERROR_BOUNDARY_ID);
        if (name === "app-error") await expect(errorPage).toBeVisible();
        else if (await errorPage.count())
            problems.push(`${name}: rendered the error page`);
        const thrown = pageErrors.splice(before);
        if (thrown.length) problems.push(`${name}: ${thrown.join(" | ")}`);
        await step(name);
    }
    expect(problems, problems.join("\n")).toEqual([]);
};

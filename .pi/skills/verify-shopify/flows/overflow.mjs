// overflow: fails when content is wider than a box that clips or scrolls it, e.g. a Polaris table cutting its last column.
import { writeFileSync } from "node:fs";
import { selectedScenarios } from "./scenarios.mjs";

// Runs in the page. Walks open shadow roots too: Polaris tables scroll inside s-table's shadow DOM.
// A box that clips always counts; one that scrolls counts only inside a table (code snippets scroll on purpose).
function findClipped() {
    const found = [];
    const label = (el) => {
        const cls = String(el.className || "")
            .trim()
            .split(/\s+/)[0];
        return cls ? `${el.localName}.${cls}` : el.localName;
    };
    const hosts = (el) => {
        const chain = [];
        for (
            let root = el.getRootNode();
            root.host;
            root = root.host.getRootNode()
        )
            chain.unshift(root.host.localName);
        return chain;
    };
    const cutsContent = (el, chain) => {
        // 1px boxes are screen-reader-only text, clipped by design.
        if (el.clientWidth <= 1 || el.scrollWidth <= el.clientWidth + 1)
            return false;
        const overflow = getComputedStyle(el).overflowX;
        if (overflow === "hidden" || overflow === "clip") return true;
        return (
            (overflow === "auto" || overflow === "scroll") &&
            chain.includes("s-table")
        );
    };
    const walk = (root) => {
        for (const el of root.querySelectorAll("*")) {
            if (el.shadowRoot) walk(el.shadowRoot);
            const chain = hosts(el);
            if (!cutsContent(el, chain)) continue;
            found.push({
                element: [...chain, label(el)].join(" > "),
                contentWidth: el.scrollWidth,
                boxWidth: el.clientWidth,
                text: (el.textContent ?? "").trim().slice(0, 80),
            });
        }
    };
    walk(document);
    return found;
}

export default async ({ page, open, step, expect }) => {
    const report = [];
    for (const [name, path, scenario] of selectedScenarios()) {
        await open(path, scenario);
        const clipped = await page.evaluate(findClipped);
        if (clipped.length) {
            report.push({ scenario: name, clipped });
            await step(name);
        }
    }
    writeFileSync(
        `${process.env.EVIDENCE_DIR}/overflow.json`,
        `${JSON.stringify(report, null, 2)}\n`
    );
    const lines = report.flatMap(({ scenario, clipped }) =>
        clipped.map(
            (c) =>
                `${scenario}: ${c.element} ${c.contentWidth}px in ${c.boxWidth}px`
        )
    );
    expect(lines, lines.join("\n")).toEqual([]);
};

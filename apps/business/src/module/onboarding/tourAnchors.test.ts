import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTours } from "./tours";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const { canOnchain } = vi.hoisted(() => ({ canOnchain: { value: true } }));
vi.mock("@/module/common/hook/useCapabilities", () => ({
    useCapabilities: () => ({ canOnchain: canOnchain.value }),
}));

/** Steps about the whole page or the product, with nothing on screen to point at. */
const CENTERED = new Set([
    "welcome.intro",
    "welcome.payouts",
    "welcome.linkWallet",
    "stores.overview",
    "campaignsOverview.overview",
]);

function allSteps() {
    const steps = [];
    for (const value of [true, false]) {
        canOnchain.value = value;
        const { result } = renderHook(() => useTours());
        for (const [tourId, tourSteps] of Object.entries(result.current)) {
            for (const step of tourSteps) {
                steps.push({ key: `${tourId}.${step.id}`, target: step.target });
            }
        }
    }
    return steps;
}

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
            ? [path]
            : [];
    });
}

describe("tour anchors", () => {
    it("points every step at an element, except the page and product intros", () => {
        const untargeted = allSteps()
            .filter((step) => !step.target && !CENTERED.has(step.key))
            .map((step) => step.key);

        expect([...new Set(untargeted)]).toEqual([]);
    });

    it("only targets data-tour values that exist in the app", () => {
        const anchorLines = sourceFiles(join(__dirname, "../.."))
            .flatMap((file) => readFileSync(file, "utf8").split("\n"))
            .filter((line) => /data-tour|dataTour/.test(line));
        const missing = allSteps()
            .map((step) => step.target)
            .filter((target): target is string => Boolean(target))
            .filter(
                (target) =>
                    !anchorLines.some((line) => line.includes(`"${target}"`))
            );

        expect([...new Set(missing)]).toEqual([]);
    });
});

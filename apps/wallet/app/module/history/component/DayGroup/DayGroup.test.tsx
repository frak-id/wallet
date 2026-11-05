import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryDayGroup } from "./index";

const i18n = vi.hoisted(() => ({ language: "en" }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n }),
}));

type Row = { id: string; label: string };

function renderGroup(rows: Row[], dayTotals?: Record<string, number>) {
    return (
        <HistoryDayGroup
            group={{ Today: rows }}
            innerComponent={(row) => <span>{row.label}</span>}
            dayTotals={dayTotals}
        />
    );
}

describe("HistoryDayGroup", () => {
    it("keeps a row mounted when a newer row is added above it", () => {
        const older = { id: "older", label: "Older reward" };
        const { rerender } = render(renderGroup([older]));
        const before = screen.getByText("Older reward");

        rerender(renderGroup([{ id: "newer", label: "Newer reward" }, older]));

        expect(screen.getByText("Older reward")).toBe(before);
    });

    it.each([
        ["en", "+€1,234.50"],
        ["fr", "+1\u202f234,50\u00a0€"],
    ])("formats the day total for the %s locale", (language, expected) => {
        i18n.language = language;

        render(renderGroup([], { Today: 1234.5 }));

        expect(
            screen.getByText(expected, { normalizer: (text) => text })
        ).toBeInTheDocument();
    });
});

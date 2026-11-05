import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryDayGroup } from "./index";

type Row = { id: string; label: string };

function renderGroup(rows: Row[]) {
    return (
        <HistoryDayGroup
            group={{ Today: rows }}
            innerComponent={(row) => <span>{row.label}</span>}
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
});

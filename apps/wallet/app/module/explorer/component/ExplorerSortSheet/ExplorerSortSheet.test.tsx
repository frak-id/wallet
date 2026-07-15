import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    DEFAULT_EXPLORER_SORT,
    explorerSortStore,
} from "@/module/explorer/stores/explorerSortStore";
import { ExplorerSortSheet } from "./index";

// t returns the key so options can be queried by their i18n key.
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const renderSheet = (onOpenChange = vi.fn()) => {
    render(<ExplorerSortSheet open={true} onOpenChange={onOpenChange} />);
    return { onOpenChange };
};

describe("ExplorerSortSheet", () => {
    beforeEach(() => {
        explorerSortStore.getState().setSort(DEFAULT_EXPLORER_SORT);
    });

    it("applies the selected sort and closes on Apply", () => {
        const { onOpenChange } = renderSheet();

        fireEvent.click(
            screen.getByRole("radio", { name: "explorer.sort.reward" })
        );
        fireEvent.click(screen.getByText("explorer.sort.apply"));

        expect(explorerSortStore.getState().sort).toBe("reward");
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("leaves the applied sort untouched when dismissed without applying", () => {
        renderSheet();

        fireEvent.click(
            screen.getByRole("radio", { name: "explorer.sort.recent" })
        );

        // No Apply tap → the store keeps its previous value.
        expect(explorerSortStore.getState().sort).toBe("recommended");
    });

    it("re-syncs the pending selection to the applied sort on reopen", () => {
        const { rerender } = render(
            <ExplorerSortSheet open={true} onOpenChange={vi.fn()} />
        );

        // Pick a non-applied option, then dismiss without applying.
        fireEvent.click(
            screen.getByRole("radio", { name: "explorer.sort.recent" })
        );
        expect(
            screen.getByRole("radio", { name: "explorer.sort.recent" })
        ).toBeChecked();
        rerender(<ExplorerSortSheet open={false} onOpenChange={vi.fn()} />);

        // Reopening resets the pending choice back to the applied default.
        rerender(<ExplorerSortSheet open={true} onOpenChange={vi.fn()} />);
        expect(
            screen.getByRole("radio", { name: "explorer.sort.recommended" })
        ).toBeChecked();
    });
});

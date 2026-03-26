import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyPendingGainsModal } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("EmptyPendingGainsModal", () => {
    it("should call onOpenChange with false when confirm button is clicked", async () => {
        const onOpenChange = vi.fn();

        render(
            <EmptyPendingGainsModal open={true} onOpenChange={onOpenChange} />
        );

        fireEvent.click(
            await screen.findByRole("button", {
                name: "wallet.pendingEmpty.confirm",
            })
        );

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyTransferredGainsModal } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("EmptyTransferredGainsModal", () => {
    it("should call onOpenChange with false when confirm button is clicked", async () => {
        const onOpenChange = vi.fn();

        render(
            <EmptyTransferredGainsModal
                open={true}
                onOpenChange={onOpenChange}
            />
        );

        fireEvent.click(
            await screen.findByRole("button", {
                name: "wallet.transferredEmpty.confirm",
            })
        );

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});

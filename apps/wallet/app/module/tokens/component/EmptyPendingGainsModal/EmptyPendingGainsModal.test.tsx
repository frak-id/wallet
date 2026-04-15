import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyPendingGainsModal } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("EmptyPendingGainsModal", () => {
    it("should call onClose when confirm button is clicked", async () => {
        const onClose = vi.fn();

        render(<EmptyPendingGainsModal onClose={onClose} />);

        fireEvent.click(
            await screen.findByRole("button", {
                name: "wallet.pendingEmpty.confirm",
            })
        );

        expect(onClose).toHaveBeenCalled();
    });
});

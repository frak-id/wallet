import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyTransferredGainsModal } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("EmptyTransferredGainsModal", () => {
    it("should call onClose when confirm button is clicked", async () => {
        const onClose = vi.fn();

        render(<EmptyTransferredGainsModal onClose={onClose} />);

        fireEvent.click(
            await screen.findByRole("button", {
                name: "wallet.transferredEmpty.confirm",
            })
        );

        expect(onClose).toHaveBeenCalled();
    });
});

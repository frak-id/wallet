import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyTransferModal } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("EmptyTransferModal", () => {
    it("should call onClose when close button is clicked", async () => {
        const onClose = vi.fn();

        render(<EmptyTransferModal onClose={onClose} />);

        fireEvent.click(
            await screen.findByRole("button", { name: "common.close" })
        );

        expect(onClose).toHaveBeenCalled();
    });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyTransferModal } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("EmptyTransferModal", () => {
    it("should call onOpenChange with false when close button is clicked", async () => {
        const onOpenChange = vi.fn();

        render(<EmptyTransferModal open={true} onOpenChange={onOpenChange} />);

        fireEvent.click(
            await screen.findByRole("button", { name: "common.close" })
        );

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});

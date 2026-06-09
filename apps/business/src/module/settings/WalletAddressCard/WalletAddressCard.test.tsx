import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@frak-labs/react-sdk", () => ({
    useWalletStatus: () => ({ data: { wallet: "0xABC123" } }),
}));

import { WalletAddressCard } from "./index";

describe("WalletAddressCard", () => {
    it("shows the wallet address and copies it to the clipboard", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });

        render(<WalletAddressCard />);

        expect(screen.getByText("0xABC123")).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "settings.wallet.copy" })
        );
        await waitFor(() => expect(writeText).toHaveBeenCalledWith("0xABC123"));
    });
});

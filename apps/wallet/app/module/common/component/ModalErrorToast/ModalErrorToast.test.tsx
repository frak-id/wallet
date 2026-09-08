import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modalErrorStore } from "@/module/stores/modalErrorStore";
import { ModalErrorToast } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) =>
            ({
                "wallet.modalError.title": "Couldn't open that",
                "wallet.modalError.message":
                    "The app was updated since this page loaded. Reload to continue.",
                "wallet.modalError.reload": "Reload",
                "common.close": "Close",
            })[key] ?? key,
    }),
}));

describe("ModalErrorToast", () => {
    const realLocation = window.location;

    beforeEach(() => {
        modalErrorStore.setState({ raised: false });
    });

    // The reload test swaps `window.location`; jsdom is shared across the
    // worker, so leaving the stub in place breaks any sibling reading it.
    afterEach(() => {
        Object.defineProperty(window, "location", {
            value: realLocation,
            writable: true,
        });
    });

    it("stays hidden until a modal actually fails", () => {
        render(<ModalErrorToast />);

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("tells the user the modal could not open once raised", () => {
        modalErrorStore.getState().raise();
        render(<ModalErrorToast />);

        expect(screen.getByRole("alert")).toHaveTextContent(
            "Couldn't open that"
        );
    });

    it("offers reloading rather than a retry it cannot perform", () => {
        const reload = vi.fn();
        Object.defineProperty(window, "location", {
            value: { reload },
            writable: true,
        });
        modalErrorStore.getState().raise();
        render(<ModalErrorToast />);

        screen.getByText("Reload").click();

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("dismisses without reloading, leaving the user where they were", () => {
        modalErrorStore.getState().raise();
        render(<ModalErrorToast />);

        screen.getByRole("button", { name: "Close" }).click();

        expect(modalErrorStore.getState().raised).toBe(false);
    });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWebauthnErrorToastStore } from "../stores/webauthnErrorToastStore";
import { WebauthnErrorToast } from "./WebauthnErrorToast";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

function show(
    error: Error,
    opts?: { operation?: "login" | "register"; onRetry?: () => void }
) {
    useWebauthnErrorToastStore.getState().show({ error, ...opts });
}

afterEach(() => {
    useWebauthnErrorToastStore.setState({ current: null });
});

describe("WebauthnErrorToast", () => {
    it("renders nothing when the store is empty", () => {
        const { container } = render(<WebauthnErrorToast />);
        expect(container.firstChild).toBeNull();
    });

    it("renders the resolved title and message for the active error", () => {
        show(new Error("boom"));
        render(<WebauthnErrorToast />);
        expect(
            screen.getByText("error.webauthn.generic.title")
        ).toBeInTheDocument();
        expect(
            screen.getByText("error.webauthn.generic.message")
        ).toBeInTheDocument();
    });

    it("renders the sync-failed guidance steps", () => {
        const folsom = new Error("[50162] folsom");
        show(folsom);
        render(<WebauthnErrorToast />);
        expect(
            screen.getByText("error.webauthn.syncFailed.step1")
        ).toBeInTheDocument();
        expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    it("fires onRetry and clears the toast from the retry action", () => {
        const onRetry = vi.fn();
        show(
            Object.assign(new Error("cancelled"), { name: "NotAllowedError" }),
            {
                onRetry,
            }
        );
        render(<WebauthnErrorToast />);

        fireEvent.click(
            screen.getByRole("button", { name: "error.webauthn.retry" })
        );
        expect(onRetry).toHaveBeenCalledOnce();
        expect(useWebauthnErrorToastStore.getState().current).toBeNull();
    });

    it("offers a 'log in' action for an already-registered error", () => {
        const onRetry = vi.fn();
        show(
            Object.assign(new Error("exists"), { name: "InvalidStateError" }),
            { operation: "register", onRetry }
        );
        render(<WebauthnErrorToast />);

        expect(
            screen.queryByRole("button", { name: "error.webauthn.retry" })
        ).toBeNull();
        fireEvent.click(
            screen.getByRole("button", { name: "error.webauthn.login" })
        );
        expect(onRetry).toHaveBeenCalledOnce();
    });

    it("clears the toast from the close button", () => {
        show(new Error("boom"));
        render(<WebauthnErrorToast />);

        fireEvent.click(
            screen.getByRole("button", { name: "error.webauthn.dismiss" })
        );
        expect(useWebauthnErrorToastStore.getState().current).toBeNull();
    });
});

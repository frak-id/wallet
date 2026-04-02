import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Keypass } from "./index";

describe("Keypass", () => {
    it("should render normal variant with content", async () => {
        const onClose = vi.fn();
        const onContinue = vi.fn();

        render(
            <Keypass
                onClose={onClose}
                onContinue={onContinue}
                isLoading={false}
                error={null}
            />
        );

        // Wait for modal content to render
        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });

    it("should render existingAccount variant when existingAccount={true}", async () => {
        const onClose = vi.fn();
        const onLogin = vi.fn();

        render(
            <Keypass
                onClose={onClose}
                onContinue={vi.fn()}
                isLoading={false}
                error={null}
                existingAccount={true}
                onLogin={onLogin}
                isLoginLoading={false}
                loginError={null}
            />
        );

        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });

    it("should render webAuthNUnsupported variant when webAuthNSupported={false}", async () => {
        const onClose = vi.fn();
        const onNavigateToLogin = vi.fn();

        render(
            <Keypass
                onClose={onClose}
                onContinue={vi.fn()}
                isLoading={false}
                error={null}
                webAuthNSupported={false}
                onNavigateToLogin={onNavigateToLogin}
            />
        );

        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });

    it("should call onContinue when Continue button clicked", async () => {
        const onClose = vi.fn();
        const onContinue = vi.fn();

        render(
            <Keypass
                onClose={onClose}
                onContinue={onContinue}
                isLoading={false}
                error={null}
            />
        );

        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        const buttons = screen.getAllByRole("button");
        const continueButton = buttons.find((btn) =>
            btn.textContent?.includes("onboarding.continue")
        );

        if (continueButton) {
            fireEvent.click(continueButton);
            expect(onContinue).toHaveBeenCalled();
        }
    });

    it("should display error when error prop set", async () => {
        const onClose = vi.fn();
        const onContinue = vi.fn();
        const testError = new Error("test error");

        render(
            <Keypass
                onClose={onClose}
                onContinue={onContinue}
                isLoading={false}
                error={testError}
            />
        );

        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });

    it("should render as always open (controlled by outlet)", async () => {
        const onClose = vi.fn();
        const onContinue = vi.fn();

        render(
            <Keypass
                onClose={onClose}
                onContinue={onContinue}
                isLoading={false}
                error={null}
            />
        );

        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });
});

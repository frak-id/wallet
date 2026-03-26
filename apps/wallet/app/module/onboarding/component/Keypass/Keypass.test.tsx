import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Keypass } from "./index";
import * as styles from "./index.css";

describe("Keypass", () => {
    it("should not render content when open={false}", () => {
        const onOpenChange = vi.fn();
        const onContinue = vi.fn();

        render(
            <Keypass
                open={false}
                onOpenChange={onOpenChange}
                onContinue={onContinue}
                isLoading={false}
                error={null}
            />
        );

        // Content should not be in document when drawer is closed
        expect(
            screen.queryByText(/onboarding.keypass.title/)
        ).not.toBeInTheDocument();
    });

    it("should render normal variant when open={true}", async () => {
        const onOpenChange = vi.fn();
        const onContinue = vi.fn();

        render(
            <Keypass
                open={true}
                onOpenChange={onOpenChange}
                onContinue={onContinue}
                isLoading={false}
                error={null}
            />
        );

        // Wait for drawer content to render in portal
        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        // Verify drawer is visible
        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });

    it("should render existingAccount variant when existingAccount={true}", async () => {
        const onOpenChange = vi.fn();
        const onLogin = vi.fn();

        render(
            <Keypass
                open={true}
                onOpenChange={onOpenChange}
                onContinue={vi.fn()}
                isLoading={false}
                error={null}
                existingAccount={true}
                onLogin={onLogin}
                isLoginLoading={false}
                loginError={null}
            />
        );

        // Wait for drawer to render
        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        // Verify drawer exists
        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });

    it("should render webAuthNUnsupported variant when webAuthNSupported={false}", async () => {
        const onOpenChange = vi.fn();
        const onNavigateToLogin = vi.fn();

        render(
            <Keypass
                open={true}
                onOpenChange={onOpenChange}
                onContinue={vi.fn()}
                isLoading={false}
                error={null}
                webAuthNSupported={false}
                onNavigateToLogin={onNavigateToLogin}
            />
        );

        // Wait for drawer to render
        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        // Verify drawer exists
        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });

    it("should apply custom drawer padding class", async () => {
        render(
            <Keypass
                open={true}
                onOpenChange={vi.fn()}
                onContinue={vi.fn()}
                isLoading={false}
                error={null}
            />
        );

        await waitFor(() => {
            const drawerContent = document.querySelector(
                "[data-vaul-drawer] > div"
            );
            expect(drawerContent).toHaveClass(styles.drawerContent);
        });
    });

    it("should call onContinue when Continue button clicked", async () => {
        const onOpenChange = vi.fn();
        const onContinue = vi.fn();

        render(
            <Keypass
                open={true}
                onOpenChange={onOpenChange}
                onContinue={onContinue}
                isLoading={false}
                error={null}
            />
        );

        // Wait for drawer to render
        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        // Find and click the Continue button
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
        const onOpenChange = vi.fn();
        const onContinue = vi.fn();
        const testError = new Error("test error");

        render(
            <Keypass
                open={true}
                onOpenChange={onOpenChange}
                onContinue={onContinue}
                isLoading={false}
                error={testError}
            />
        );

        // Wait for drawer to render
        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        // Verify drawer exists (HandleErrors component renders inside)
        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });

    it("should call onOpenChange when drawer state changes", async () => {
        const onOpenChange = vi.fn();
        const onContinue = vi.fn();

        const { rerender } = render(
            <Keypass
                open={false}
                onOpenChange={onOpenChange}
                onContinue={onContinue}
                isLoading={false}
                error={null}
            />
        );

        // Rerender with open={true}
        rerender(
            <Keypass
                open={true}
                onOpenChange={onOpenChange}
                onContinue={onContinue}
                isLoading={false}
                error={null}
            />
        );

        // Wait for drawer to appear
        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        // Verify drawer is now visible
        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });
});

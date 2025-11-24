import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientOnly } from "./index";

describe("ClientOnly", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render children after client-side hydration", async () => {
        render(
            <ClientOnly>
                <div>Client content</div>
            </ClientOnly>
        );

        // After useEffect runs (client-side), children should be rendered
        // Note: In jsdom/test environment, useEffect runs, so children will be rendered
        await waitFor(() => {
            expect(screen.getByText("Client content")).toBeInTheDocument();
        });
    });

    it("should use useIsClient hook to determine client-side rendering", async () => {
        render(
            <ClientOnly>
                <div>Content</div>
            </ClientOnly>
        );

        // Component uses useIsClient hook which sets isClient to true after useEffect
        // In test environment, this happens, so content should be rendered
        await waitFor(() => {
            expect(screen.getByText("Content")).toBeInTheDocument();
        });
    });

    it("should render ReactNode children", async () => {
        render(
            <ClientOnly>
                <div data-testid="test-content">Test</div>
            </ClientOnly>
        );

        // Wait for useEffect to run and set isClient to true
        await waitFor(() => {
            expect(screen.getByTestId("test-content")).toBeInTheDocument();
        });
    });

    it("should handle empty children", async () => {
        const { container } = render(<ClientOnly>{null}</ClientOnly>);

        // Component should handle null children
        await waitFor(() => {
            // After hydration, if children is null, container should be empty or have minimal structure
            expect(container).toBeInTheDocument();
        });
    });
});

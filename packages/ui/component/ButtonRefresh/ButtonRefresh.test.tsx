import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ButtonRefresh } from "./index";

// Mock QueryClient
const createTestQueryClient = () => {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
};

describe("ButtonRefresh", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = createTestQueryClient();
        vi.clearAllMocks();
    });

    const renderWithProvider = (children: React.ReactNode) => {
        return render(
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    };

    it("should render with default refresh icon", () => {
        renderWithProvider(<ButtonRefresh />);
        const button = screen.getByRole("button");
        expect(button).toBeInTheDocument();
        // Refresh icon should be present
        expect(button.querySelector("svg")).toBeInTheDocument();
    });

    it("should render with custom children", () => {
        renderWithProvider(<ButtonRefresh>Custom content</ButtonRefresh>);
        expect(screen.getByText("Custom content")).toBeInTheDocument();
    });

    it("should have title attribute", () => {
        renderWithProvider(<ButtonRefresh />);
        expect(screen.getByRole("button")).toHaveAttribute(
            "title",
            "Force refresh"
        );
    });

    it("should call resetQueries when clicked", async () => {
        const resetQueriesSpy = vi.spyOn(queryClient, "resetQueries");

        renderWithProvider(<ButtonRefresh />);

        const button = screen.getByRole("button");
        fireEvent.click(button);

        await waitFor(() => {
            expect(resetQueriesSpy).toHaveBeenCalledTimes(1);
        });
    });

    it("should show refreshing state after click", async () => {
        renderWithProvider(<ButtonRefresh />);

        const button = screen.getByRole("button");
        fireEvent.click(button);

        // Button should have refreshing class
        await waitFor(() => {
            expect(button.className).toContain("buttonRefreshing");
        });
    });

    it("should apply custom className", () => {
        renderWithProvider(<ButtonRefresh className="custom-class" />);
        const button = screen.getByRole("button");
        expect(button.className).toContain("custom-class");
    });

    it("should reset refreshing state after timeout", async () => {
        vi.useFakeTimers();
        renderWithProvider(<ButtonRefresh />);

        const button = screen.getByRole("button");
        fireEvent.click(button);

        // Button should have refreshing class
        expect(button.className).toContain("buttonRefreshing");

        // Fast-forward time
        await vi.advanceTimersByTimeAsync(2000);

        // Button should no longer have refreshing class
        expect(button.className).not.toContain("buttonRefreshing");

        vi.useRealTimers();
    });
});

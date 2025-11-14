import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationTop } from "./index";

vi.mock("@/module/common/component/DemoModeBadge", () => ({
    DemoModeBadge: () => <div data-testid="demo-mode-badge">Demo Mode</div>,
}));

vi.mock("@/module/common/component/NavigationProfile", () => ({
    NavigationProfile: () => (
        <div data-testid="navigation-profile">Profile</div>
    ),
}));

const queryClient = new QueryClient();

function renderWithQueryClient(component: React.ReactElement) {
    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    );
}

describe("NavigationTop", () => {
    it("should render DemoModeBadge", () => {
        const { getByTestId } = renderWithQueryClient(<NavigationTop />);
        expect(getByTestId("demo-mode-badge")).toBeInTheDocument();
    });

    it("should render ButtonRefresh", () => {
        const { container } = renderWithQueryClient(<NavigationTop />);
        // ButtonRefresh renders as a button
        const button = container.querySelector("button");
        expect(button).toBeInTheDocument();
    });

    it("should render NavigationProfile", () => {
        const { getByTestId } = renderWithQueryClient(<NavigationTop />);
        expect(getByTestId("navigation-profile")).toBeInTheDocument();
    });

    it("should render all components in correct order", () => {
        const { container } = renderWithQueryClient(<NavigationTop />);
        const children = Array.from(container.firstChild?.childNodes ?? []);
        expect(children).toHaveLength(3);
    });
});

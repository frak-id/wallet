import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel, PanelTitle } from "./index";

vi.mock("@/module/common/component/Title", () => ({
    Title: ({ children, icon, size, className }: any) => (
        <div data-testid="title" data-size={size} className={className}>
            {icon}
            {children}
        </div>
    ),
}));

describe("Panel", () => {
    it("should render children", () => {
        render(
            <Panel>
                <div>Panel content</div>
            </Panel>
        );

        expect(screen.getByText("Panel content")).toBeInTheDocument();
    });

    it("should render with title", () => {
        render(<Panel title="Test Panel">Content</Panel>);

        expect(screen.getByText("Test Panel")).toBeInTheDocument();
    });

    it("should render without title", () => {
        render(<Panel>Content</Panel>);

        expect(screen.getByText("Content")).toBeInTheDocument();
        expect(screen.queryByTestId("title")).not.toBeInTheDocument();
    });

    it("should render with badge by default", () => {
        render(<Panel title="Test Panel">Content</Panel>);

        const title = screen.getByTestId("title");
        expect(title).toBeInTheDocument();
        // Badge icon should be present
        expect(title.querySelector("svg")).toBeInTheDocument();
    });

    it("should render without badge when withBadge is false", () => {
        render(
            <Panel title="Test Panel" withBadge={false}>
                Content
            </Panel>
        );

        const title = screen.getByTestId("title");
        expect(title).toBeInTheDocument();
        // Badge icon should not be present
        expect(title.querySelector("svg")).not.toBeInTheDocument();
    });

    it("should apply variant classes", () => {
        const { container } = render(
            <Panel variant="secondary">Content</Panel>
        );

        const panel = container.firstChild as HTMLElement;
        expect(panel).toBeInTheDocument();
        expect(panel.className).toBeTruthy();
    });
});

describe("PanelTitle", () => {
    it("should render title with badge", () => {
        render(<PanelTitle title="Test Title" />);

        expect(screen.getByText("Test Title")).toBeInTheDocument();
        expect(screen.getByTestId("title")).toBeInTheDocument();
    });

    it("should render title without badge", () => {
        render(<PanelTitle title="Test Title" withBadge={false} />);

        expect(screen.getByText("Test Title")).toBeInTheDocument();
        const title = screen.getByTestId("title");
        expect(title.querySelector("svg")).not.toBeInTheDocument();
    });

    it("should not render when title is undefined", () => {
        const { container } = render(<PanelTitle />);

        expect(container.firstChild).toBeNull();
    });
});

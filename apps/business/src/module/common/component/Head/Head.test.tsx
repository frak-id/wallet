import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Head } from "./index";

describe("Head", () => {
    it("should render with title", () => {
        render(<Head title={{ content: "Test Title" }} />);

        expect(screen.getByText("Test Title")).toBeInTheDocument();
    });

    it("should render with custom title size", () => {
        render(<Head title={{ content: "Test Title", size: "big" }} />);

        expect(screen.getByText("Test Title")).toBeInTheDocument();
    });

    it("should render leftSection", () => {
        render(
            <Head
                title={{ content: "Title" }}
                leftSection={<span data-testid="left">Left content</span>}
            />
        );

        expect(screen.getByTestId("left")).toBeInTheDocument();
    });

    it("should render rightSection", () => {
        render(
            <Head
                title={{ content: "Title" }}
                rightSection={<span data-testid="right">Right content</span>}
            />
        );

        expect(screen.getByTestId("right")).toBeInTheDocument();
    });

    it("should render without title", () => {
        const { container } = render(<Head />);

        expect(container.firstChild).toBeInTheDocument();
    });

    it("should render with all sections", () => {
        render(
            <Head
                title={{ content: "Title" }}
                leftSection={<span data-testid="left">Left</span>}
                rightSection={<span data-testid="right">Right</span>}
            />
        );

        expect(screen.getByText("Title")).toBeInTheDocument();
        expect(screen.getByTestId("left")).toBeInTheDocument();
        expect(screen.getByTestId("right")).toBeInTheDocument();
    });
});

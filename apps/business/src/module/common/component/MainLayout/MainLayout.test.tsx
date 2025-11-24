import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MainLayout } from "./index";

describe("MainLayout", () => {
    it("should render children", () => {
        render(
            <MainLayout>
                <div>Main content</div>
            </MainLayout>
        );

        expect(screen.getByText("Main content")).toBeInTheDocument();
    });

    it("should render as main element", () => {
        const { container } = render(
            <MainLayout>
                <div>Content</div>
            </MainLayout>
        );

        const main = container.querySelector("main");
        expect(main).toBeInTheDocument();
    });

    it("should render multiple children", () => {
        render(
            <MainLayout>
                <div>First</div>
                <div>Second</div>
            </MainLayout>
        );

        expect(screen.getByText("First")).toBeInTheDocument();
        expect(screen.getByText("Second")).toBeInTheDocument();
    });
});

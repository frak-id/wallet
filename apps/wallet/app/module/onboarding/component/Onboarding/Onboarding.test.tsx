import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Onboarding } from "./index";

describe("Onboarding", () => {
    it("should render all slides with buttonLabel when lastButtonLabel not provided", () => {
        const onFinish = vi.fn();
        render(
            <Onboarding buttonLabel="Next" onFinish={onFinish}>
                <div data-testid="slide-1">Slide 1</div>
                <div data-testid="slide-2">Slide 2</div>
                <div data-testid="slide-3">Slide 3</div>
            </Onboarding>
        );

        expect(screen.getByText("Slide 1")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Next" })
        ).toBeInTheDocument();
    });

    it("should show buttonLabel on non-last slides when lastButtonLabel is provided", () => {
        const onFinish = vi.fn();
        render(
            <Onboarding
                buttonLabel="Next"
                lastButtonLabel="Finish"
                onFinish={onFinish}
            >
                <div data-testid="slide-1">Slide 1</div>
                <div data-testid="slide-2">Slide 2</div>
            </Onboarding>
        );

        expect(
            screen.getByRole("button", { name: "Next" })
        ).toBeInTheDocument();
    });

    it("should show lastButtonLabel on the last slide when provided", () => {
        const onFinish = vi.fn();

        render(
            <Onboarding
                buttonLabel="Next"
                lastButtonLabel="Finish"
                onFinish={onFinish}
            >
                <div data-testid="slide-1">Slide 1</div>
            </Onboarding>
        );

        expect(
            screen.getByRole("button", { name: "Finish" })
        ).toBeInTheDocument();
    });

    it("should call onFinish when button is clicked on the last slide", () => {
        const onFinish = vi.fn();

        render(
            <Onboarding
                buttonLabel="Next"
                lastButtonLabel="Finish"
                onFinish={onFinish}
            >
                <div data-testid="slide-1">Slide 1</div>
            </Onboarding>
        );

        fireEvent.click(screen.getByRole("button", { name: "Finish" }));

        expect(onFinish).toHaveBeenCalled();
    });

    it("should render children correctly", () => {
        const onFinish = vi.fn();
        render(
            <Onboarding buttonLabel="Next" onFinish={onFinish}>
                <div data-testid="slide-1">Content 1</div>
                <div data-testid="slide-2">Content 2</div>
            </Onboarding>
        );

        expect(screen.getByTestId("slide-1")).toBeInTheDocument();
        expect(screen.getByTestId("slide-2")).toBeInTheDocument();
    });

    it("should render dots for each slide", () => {
        const onFinish = vi.fn();
        const { container } = render(
            <Onboarding buttonLabel="Next" onFinish={onFinish}>
                <div>Slide 1</div>
                <div>Slide 2</div>
                <div>Slide 3</div>
            </Onboarding>
        );

        // Dots are rendered inside each slide — check the first slide
        const firstSlide = container.querySelector("[data-index='0']");
        expect(firstSlide).toBeTruthy();

        // The dots container is the last child of each slide
        const dotsContainer = firstSlide?.lastElementChild;
        expect(dotsContainer?.children).toHaveLength(3);
    });

    it("should maintain backward compatibility when lastButtonLabel is not provided", () => {
        const onFinish = vi.fn();
        render(
            <Onboarding buttonLabel="Continue" onFinish={onFinish}>
                <div>Slide 1</div>
                <div>Slide 2</div>
            </Onboarding>
        );

        expect(
            screen.getByRole("button", { name: "Continue" })
        ).toBeInTheDocument();
    });

    it("should render recovery code button on first slide", () => {
        const onFinish = vi.fn();
        render(
            <Onboarding buttonLabel="Next" onFinish={onFinish}>
                <div>Slide 1</div>
            </Onboarding>
        );

        expect(
            screen.getByRole("button", { name: "onboarding.recoveryCode" })
        ).toBeInTheDocument();
    });
});

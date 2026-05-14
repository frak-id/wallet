import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OnboardingHeroProps } from "../step/OnboardingHero";
import { OnboardingStep } from "./index";

const hero: OnboardingHeroProps = {
    translationKey: "one",
    image: "test.webp",
};

describe.sequential("OnboardingStep", () => {
    it("renders the step title and primary CTA", () => {
        render(
            <OnboardingStep
                hero={hero}
                buttonLabel="Continue"
                onContinue={vi.fn()}
            />
        );

        expect(
            screen.getByText("onboarding.steps.one.title")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Continue" })
        ).toBeInTheDocument();
    });

    it("calls onContinue when the primary CTA is clicked", () => {
        const onContinue = vi.fn();
        render(
            <OnboardingStep
                hero={hero}
                buttonLabel="Continue"
                onContinue={onContinue}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Continue" }));
        expect(onContinue).toHaveBeenCalled();
    });

    it("renders a Back button when onBack is provided", () => {
        const onBack = vi.fn();
        render(
            <OnboardingStep
                hero={hero}
                buttonLabel="Continue"
                onContinue={vi.fn()}
                onBack={onBack}
            />
        );

        const back = screen.getByRole("button", { name: "common.back" });
        fireEvent.click(back);
        expect(onBack).toHaveBeenCalled();
    });

    it("does not render a Back button when onBack is omitted", () => {
        render(
            <OnboardingStep
                hero={hero}
                buttonLabel="Continue"
                onContinue={vi.fn()}
            />
        );

        expect(
            screen.queryByRole("button", { name: "common.back" })
        ).not.toBeInTheDocument();
    });

    it("renders the login link when loginLabel and onLoginClick are provided", () => {
        const onLoginClick = vi.fn();
        render(
            <OnboardingStep
                hero={hero}
                buttonLabel="Continue"
                onContinue={vi.fn()}
                loginLabel="Already have an account?"
                onLoginClick={onLoginClick}
            />
        );

        const loginButton = screen.getByRole("button", {
            name: "Already have an account?",
        });
        fireEvent.click(loginButton);
        expect(onLoginClick).toHaveBeenCalled();
    });

    it("renders the recovery code button when handler provided", () => {
        const onRecoveryCodeClick = vi.fn();
        render(
            <OnboardingStep
                hero={hero}
                buttonLabel="Continue"
                onContinue={vi.fn()}
                onRecoveryCodeClick={onRecoveryCodeClick}
            />
        );

        const recovery = screen.getByRole("button", {
            name: "onboarding.recoveryCode",
        });
        fireEvent.click(recovery);
        expect(onRecoveryCodeClick).toHaveBeenCalled();
    });

    it("does not render the recovery code button when no handler is provided", () => {
        render(
            <OnboardingStep
                hero={hero}
                buttonLabel="Continue"
                onContinue={vi.fn()}
            />
        );

        expect(
            screen.queryByRole("button", {
                name: "onboarding.recoveryCode",
            })
        ).not.toBeInTheDocument();
    });
});

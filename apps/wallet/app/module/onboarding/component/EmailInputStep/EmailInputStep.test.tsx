import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useCheckEmail } from "@/module/authentication/hook/useCheckEmail";
import { EmailInputStep } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const checkEmailMock = vi.fn();
const resetMock = vi.fn();
let checkEmailReturn: ReturnType<typeof useCheckEmail>;

vi.mock("@/module/authentication/hook/useCheckEmail", () => ({
    useCheckEmail: () => checkEmailReturn,
}));

function setupHook(overrides: Partial<ReturnType<typeof useCheckEmail>> = {}) {
    checkEmailReturn = {
        checkEmail: checkEmailMock,
        isChecking: false,
        isError: false,
        error: null,
        reset: resetMock,
        ...overrides,
    } as ReturnType<typeof useCheckEmail>;
}

beforeEach(() => {
    vi.clearAllMocks();
    setupHook();
    checkEmailMock.mockResolvedValue({ used: false });
});

function renderStep(overrides?: {
    onContinue?: (email: string) => void;
    onBack?: () => void;
    onAlreadyUsed?: (args: {
        email: string;
        authenticatorId: string;
        wallet?: `0x${string}`;
    }) => void;
    initialValue?: string;
}) {
    const onContinue = overrides?.onContinue ?? vi.fn();
    const onBack = overrides?.onBack ?? vi.fn();
    const onAlreadyUsed = overrides?.onAlreadyUsed ?? vi.fn();
    render(
        (
            <EmailInputStep
                onContinue={onContinue}
                onBack={onBack}
                onAlreadyUsed={onAlreadyUsed}
                initialValue={overrides?.initialValue}
            />
        ) as ReactElement
    );
    return { onContinue, onBack, onAlreadyUsed };
}

function getContinueButton() {
    return screen
        .getAllByRole("button")
        .find((btn) =>
            btn.textContent?.includes("onboarding.email.continue")
        ) as HTMLButtonElement;
}

function getInput() {
    return screen.getByLabelText("onboarding.email.label") as HTMLInputElement;
}

describe("EmailInputStep", () => {
    it("renders the continue CTA disabled when input is empty", () => {
        renderStep();
        expect(getContinueButton()).toBeDisabled();
    });

    it("keeps CTA disabled for invalid email shapes", () => {
        renderStep();
        fireEvent.change(getInput(), { target: { value: "not-an-email" } });
        expect(getContinueButton()).toBeDisabled();
    });

    it("enables CTA for a valid email", () => {
        renderStep();
        fireEvent.change(getInput(), { target: { value: "a@b.co" } });
        expect(getContinueButton()).not.toBeDisabled();
    });

    it("pre-fills from initialValue", () => {
        renderStep({ initialValue: "seed@example.com" });
        expect(getInput().value).toBe("seed@example.com");
        expect(getContinueButton()).not.toBeDisabled();
    });

    it("treats whitespace-only input as empty (no clear button, CTA disabled)", () => {
        renderStep();
        fireEvent.change(getInput(), { target: { value: "   " } });
        expect(
            screen.queryByLabelText("onboarding.email.clearAriaLabel")
        ).toBeNull();
        expect(getContinueButton()).toBeDisabled();
    });

    it("shows the clear button when input has a value, and clears it", () => {
        renderStep();
        expect(
            screen.queryByLabelText("onboarding.email.clearAriaLabel")
        ).toBeNull();

        fireEvent.change(getInput(), { target: { value: "a@b.co" } });
        const clearBtn = screen.getByLabelText(
            "onboarding.email.clearAriaLabel"
        );
        fireEvent.click(clearBtn);

        expect(getInput().value).toBe("");
        expect(getContinueButton()).toBeDisabled();
    });

    it("checks the email and forwards the trimmed value when not used", async () => {
        const { onContinue } = renderStep();
        fireEvent.change(getInput(), { target: { value: "  a@b.co  " } });
        fireEvent.click(getContinueButton());
        await waitFor(() => {
            expect(checkEmailMock).toHaveBeenCalledWith("a@b.co");
        });
        await waitFor(() => {
            expect(onContinue).toHaveBeenCalledWith("a@b.co");
        });
    });

    it("does not submit when the email is invalid (Enter on form)", () => {
        const { onContinue } = renderStep();
        fireEvent.change(getInput(), { target: { value: "not-an-email" } });
        const form = getInput().closest("form");
        if (!form) throw new Error("form not found");
        fireEvent.submit(form);
        expect(checkEmailMock).not.toHaveBeenCalled();
        expect(onContinue).not.toHaveBeenCalled();
    });

    it("bubbles already-used result up via onAlreadyUsed", async () => {
        checkEmailMock.mockResolvedValue({
            used: true,
            authenticatorId: "cred-123",
            wallet: "0xabc0000000000000000000000000000000000def",
        });
        const { onContinue, onAlreadyUsed } = renderStep();
        fireEvent.change(getInput(), { target: { value: "taken@frak.id" } });
        fireEvent.click(getContinueButton());

        await waitFor(() => {
            expect(onAlreadyUsed).toHaveBeenCalledWith({
                email: "taken@frak.id",
                authenticatorId: "cred-123",
                wallet: "0xabc0000000000000000000000000000000000def",
            });
        });
        expect(onContinue).not.toHaveBeenCalled();
    });

    it("shows a retryable error when the check itself fails", async () => {
        checkEmailMock.mockRejectedValue(new Error("boom"));
        setupHook({ error: new Error("boom"), isError: true });
        const { onContinue } = renderStep();
        fireEvent.change(getInput(), { target: { value: "a@b.co" } });
        fireEvent.click(getContinueButton());
        await screen.findByText("onboarding.email.checkError");
        expect(onContinue).not.toHaveBeenCalled();
    });

    it("calls onBack when the back affordance is clicked", () => {
        const { onBack } = renderStep();
        // The Back component renders a button with no accessible name we
        // control here; match by being the first button that is not the
        // continue or clear button.
        const buttons = screen.getAllByRole("button");
        const back = buttons.find(
            (btn) =>
                !btn.textContent?.includes("onboarding.email.continue") &&
                btn.getAttribute("aria-label") !==
                    "onboarding.email.clearAriaLabel"
        );
        if (!back) throw new Error("back button not found");
        fireEvent.click(back);
        expect(onBack).toHaveBeenCalled();
    });
});

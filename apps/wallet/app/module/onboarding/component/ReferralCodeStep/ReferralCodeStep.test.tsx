import { fireEvent, render, screen } from "@testing-library/react";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReferralCodeStep } from "./index";

let capturedOptions:
    | {
          onApplied?: () => void;
          onError?: (key: string) => void;
          requireCompleteCode?: boolean;
      }
    | undefined;

let mockState: {
    isPending: boolean;
    error: { status: number } | null;
} = { isPending: false, error: null };

const mockReset = vi.fn();
const mockMutate = vi.fn();

// The hook is the only real wallet-shared dependency the component uses
// (besides `REDEMPTION_CODE_LENGTH`). We re-implement the bits the
// component actually consumes so the test stays focused on the wiring
// without needing a QueryClient or backend mocks.
vi.mock("@frak-labs/wallet-shared", () => ({
    REDEMPTION_CODE_LENGTH: 6,
    useRedeemReferralCodeForm: (
        opts: {
            onApplied?: () => void;
            onError?: (key: string) => void;
            requireCompleteCode?: boolean;
        } = {}
    ) => {
        capturedOptions = opts;
        const [code, setCode] = useState("");
        const hasValue = code.length > 0;
        const isComplete = code.length === 6;
        const canSubmit =
            (opts.requireCompleteCode === false ? hasValue : isComplete) &&
            !mockState.isPending;

        const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
            const next = e.target.value
                .replace(/[^a-zA-Z0-9]/g, "")
                .slice(0, 6)
                .toUpperCase();
            setCode(next);
        };
        const handleClear = () => {
            setCode("");
            mockReset();
        };
        const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            mockMutate({ code });
        };

        const errorMessageKey = mockState.error
            ? mockState.error.status === 404
                ? "wallet.referral.redeem.errorNotFound"
                : "wallet.referral.redeem.errorGeneric"
            : null;

        return {
            code,
            hasValue,
            isComplete,
            canSubmit,
            isPending: mockState.isPending,
            errorMessageKey,
            handleChange,
            handleClear,
            handleSubmit,
        };
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

function renderStep(overrides?: {
    onApplied?: () => void;
    onSkip?: () => void;
    onError?: (key: string) => void;
}) {
    const onApplied = overrides?.onApplied ?? vi.fn();
    const onSkip = overrides?.onSkip ?? vi.fn();
    const onError = overrides?.onError ?? vi.fn();
    render(
        <ReferralCodeStep
            onApplied={onApplied}
            onSkip={onSkip}
            onError={onError}
        />
    );
    return { onApplied, onSkip, onError };
}

function getApplyButton() {
    return screen
        .getAllByRole("button")
        .find((btn) =>
            btn.textContent?.includes("onboarding.referral.submitCta")
        ) as HTMLButtonElement;
}

function getSkipButton() {
    return screen
        .getAllByRole("button")
        .find((btn) =>
            btn.textContent?.includes("onboarding.referral.skip")
        ) as HTMLButtonElement;
}

function getInput() {
    return screen.getByLabelText(
        "onboarding.referral.label"
    ) as HTMLInputElement;
}

describe("ReferralCodeStep", () => {
    beforeEach(() => {
        mockMutate.mockReset();
        mockReset.mockReset();
        mockState = { isPending: false, error: null };
        capturedOptions = undefined;
    });

    it("passes requireCompleteCode=false to the shared hook", () => {
        renderStep();
        expect(capturedOptions?.requireCompleteCode).toBe(false);
    });

    it("renders the apply CTA disabled when input is empty", () => {
        renderStep();
        expect(getApplyButton()).toBeDisabled();
    });

    it("enables CTA when the user types a code", () => {
        renderStep();
        fireEvent.change(getInput(), { target: { value: "lola10" } });
        expect(getInput().value).toBe("LOLA10");
        expect(getApplyButton()).not.toBeDisabled();
    });

    it("shows the X clear button only when input has a value, and clears it", () => {
        renderStep();
        expect(screen.queryByLabelText("common.clear")).toBeNull();

        fireEvent.change(getInput(), { target: { value: "abc" } });
        const clearBtn = screen.getByLabelText("common.clear");
        fireEvent.click(clearBtn);

        expect(getInput().value).toBe("");
        expect(getApplyButton()).toBeDisabled();
        expect(mockReset).toHaveBeenCalled();
    });

    it("submits the typed code on Apply", () => {
        renderStep();
        fireEvent.change(getInput(), { target: { value: "lola10" } });
        fireEvent.click(getApplyButton());
        expect(mockMutate).toHaveBeenCalledWith({ code: "LOLA10" });
    });

    it("forwards onApplied/onError callbacks to the shared hook", () => {
        const onApplied = vi.fn();
        const onError = vi.fn();
        renderStep({ onApplied, onError });
        expect(capturedOptions?.onApplied).toBe(onApplied);
        expect(capturedOptions?.onError).toBe(onError);
    });

    it("calls onSkip when Passer is tapped", () => {
        const { onSkip } = renderStep();
        fireEvent.click(getSkipButton());
        expect(onSkip).toHaveBeenCalled();
    });

    it("renders the error message when the hook resolves a key", () => {
        mockState = { isPending: false, error: { status: 404 } };
        renderStep();
        expect(
            screen.getByText("wallet.referral.redeem.errorNotFound")
        ).toBeInTheDocument();
    });

    it("preserves typed value when the code is rejected", () => {
        mockState = { isPending: false, error: { status: 404 } };
        renderStep();
        fireEvent.change(getInput(), { target: { value: "wrong1" } });
        expect(getInput().value).toBe("WRONG1");
        expect(
            screen.getByText("wallet.referral.redeem.errorNotFound")
        ).toBeInTheDocument();
    });
});

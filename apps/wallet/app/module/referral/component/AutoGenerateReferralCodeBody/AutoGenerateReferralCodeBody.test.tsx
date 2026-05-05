import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutoGenerateReferralCodeBody } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock the three referral hooks the body pulls in. We control the
// suggest result + the issue/replace mutate calls per-test by reading
// the captured fns from the latest hook invocation.
const suggestMutateAsync = vi.fn();
const suggestReset = vi.fn();
const issueMutate = vi.fn();
const replaceMutate = vi.fn();
const issueReset = vi.fn();
const replaceReset = vi.fn();

let issueOnSuccess: ((data: { code: string }) => void) | null = null;
let replaceOnSuccess: ((data: { code: string }) => void) | null = null;

vi.mock("@frak-labs/wallet-shared", () => ({
    useSuggestReferralCodes: () => ({
        mutateAsync: suggestMutateAsync,
        reset: suggestReset,
        isPending: false,
        error: null,
        data: undefined,
    }),
    useIssueReferralCode: ({
        mutations,
    }: {
        mutations?: { onSuccess?: (data: { code: string }) => void };
    }) => {
        issueOnSuccess = mutations?.onSuccess ?? null;
        return {
            mutate: issueMutate,
            reset: issueReset,
            isPending: false,
            error: null,
        };
    },
    useReplaceReferralCode: ({
        mutations,
    }: {
        mutations?: { onSuccess?: (data: { code: string }) => void };
    }) => {
        replaceOnSuccess = mutations?.onSuccess ?? null;
        return {
            mutate: replaceMutate,
            reset: replaceReset,
            isPending: false,
            error: null,
        };
    },
    resolveApiErrorKey: () => null,
    getErrorCode: () => null,
}));

const renderBody = (
    props: Parameters<typeof AutoGenerateReferralCodeBody>[0]
) => {
    const utils = render(<AutoGenerateReferralCodeBody {...props} />);
    return { ...utils, scope: within(utils.container) };
};

describe.sequential("AutoGenerateReferralCodeBody", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        issueOnSuccess = null;
        replaceOnSuccess = null;
        suggestMutateAsync.mockResolvedValue({ suggestions: ["AUTO12"] });
    });

    it("auto-fetches a suggestion and renders the preview input", async () => {
        const { scope } = renderBody({
            mode: "create",
            onIssued: vi.fn(),
            onPersonalize: vi.fn(),
        });

        await waitFor(() => {
            expect(suggestMutateAsync).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(scope.getByDisplayValue("AUTO12")).toBeInTheDocument();
        });
    });

    it("submits via the issue mutation in create mode", async () => {
        const { scope } = renderBody({
            mode: "create",
            onIssued: vi.fn(),
            onPersonalize: vi.fn(),
        });

        await waitFor(() =>
            expect(scope.getByDisplayValue("AUTO12")).toBeInTheDocument()
        );

        fireEvent.click(
            scope.getByRole("button", {
                name: "wallet.referral.create.submitCta",
            })
        );

        expect(issueMutate).toHaveBeenCalledWith({ code: "AUTO12" });
        expect(replaceMutate).not.toHaveBeenCalled();
    });

    it("submits via the replace mutation in edit mode", async () => {
        const { scope } = renderBody({
            mode: "edit",
            onIssued: vi.fn(),
            onPersonalize: vi.fn(),
        });

        await waitFor(() =>
            expect(scope.getByDisplayValue("AUTO12")).toBeInTheDocument()
        );

        fireEvent.click(
            scope.getByRole("button", {
                name: "wallet.referral.create.submitCta",
            })
        );

        expect(replaceMutate).toHaveBeenCalledWith({ code: "AUTO12" });
        expect(issueMutate).not.toHaveBeenCalled();
    });

    it("calls onIssued with the issued code on success (create mode)", async () => {
        const onIssued = vi.fn();
        renderBody({
            mode: "create",
            onIssued,
            onPersonalize: vi.fn(),
        });

        await waitFor(() => expect(issueOnSuccess).toBeTruthy());

        // Simulate the mutation's onSuccess firing (react-query would call
        // this once the backend confirmed the issue).
        issueOnSuccess?.({ code: "DONE01" });
        expect(onIssued).toHaveBeenCalledWith("DONE01");
    });

    it("calls onIssued with the issued code on success (edit mode)", async () => {
        const onIssued = vi.fn();
        renderBody({
            mode: "edit",
            onIssued,
            onPersonalize: vi.fn(),
        });

        await waitFor(() => expect(replaceOnSuccess).toBeTruthy());

        replaceOnSuccess?.({ code: "DONE02" });
        expect(onIssued).toHaveBeenCalledWith("DONE02");
    });

    it("calls onPersonalize when 'Personnaliser mon code' is clicked", async () => {
        const onPersonalize = vi.fn();
        const { scope } = renderBody({
            mode: "edit",
            onIssued: vi.fn(),
            onPersonalize,
        });

        await waitFor(() =>
            expect(scope.getByDisplayValue("AUTO12")).toBeInTheDocument()
        );

        fireEvent.click(
            scope.getByRole("button", {
                name: "wallet.referral.create.personalizeCta",
            })
        );

        expect(onPersonalize).toHaveBeenCalledTimes(1);
    });
});

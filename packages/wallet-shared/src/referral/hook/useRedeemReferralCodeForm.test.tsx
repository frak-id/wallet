import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { useRedeemReferralCodeForm } from "./useRedeemReferralCodeForm";

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        referral: {
            code: {
                redeem: { post: vi.fn() },
            },
        },
    },
}));

type ChangeEventLike = React.ChangeEvent<HTMLInputElement>;
type FormEventLike = React.FormEvent<HTMLFormElement>;

const makeChange = (value: string) =>
    ({ target: { value } }) as unknown as ChangeEventLike;
const makeSubmit = () =>
    ({ preventDefault: vi.fn() }) as unknown as FormEventLike;

// Mocks are module-scoped on `authenticatedWalletApi`, so concurrent tests
// inside this file would race on `mockResolvedValue`. Run sequentially.
describe.sequential("useRedeemReferralCodeForm", () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    test("normalises input: alphanumeric, uppercase, capped at 6 chars", ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useRedeemReferralCodeForm(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => {
            result.current.handleChange(makeChange(" ab-cd ef!ghi "));
        });

        expect(result.current.code).toBe("ABCDEF");
    });

    test("requireCompleteCode default: canSubmit only when 6 chars", ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useRedeemReferralCodeForm(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.handleChange(makeChange("abc")));
        expect(result.current.hasValue).toBe(true);
        expect(result.current.canSubmit).toBe(false);

        act(() => result.current.handleChange(makeChange("abcdef")));
        expect(result.current.isComplete).toBe(true);
        expect(result.current.canSubmit).toBe(true);
    });

    test("requireCompleteCode=false: canSubmit on any non-empty value", ({
        queryWrapper,
    }) => {
        const { result } = renderHook(
            () => useRedeemReferralCodeForm({ requireCompleteCode: false }),
            { wrapper: queryWrapper.wrapper }
        );

        act(() => result.current.handleChange(makeChange("a")));
        expect(result.current.canSubmit).toBe(true);
    });

    test("handleSubmit triggers the redeem mutation with the typed code", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.redeem.post
        ).mockResolvedValue({ error: null } as never);

        const onApplied = vi.fn();
        const { result } = renderHook(
            () => useRedeemReferralCodeForm({ onApplied }),
            { wrapper: queryWrapper.wrapper }
        );

        act(() => result.current.handleChange(makeChange("lola10")));
        act(() => result.current.handleSubmit(makeSubmit()));

        await waitFor(() => expect(onApplied).toHaveBeenCalled());
        expect(
            authenticatedWalletApi.referral.code.redeem.post
        ).toHaveBeenCalledWith({ code: "LOLA10" });
    });

    test("handleSubmit no-op when canSubmit is false", ({ queryWrapper }) => {
        const { result } = renderHook(() => useRedeemReferralCodeForm(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.handleChange(makeChange("abc")));
        act(() => result.current.handleSubmit(makeSubmit()));

        expect(
            authenticatedWalletApi.referral.code.redeem.post
        ).not.toHaveBeenCalled();
    });

    test("handleClear empties the code", ({ queryWrapper }) => {
        const { result } = renderHook(() => useRedeemReferralCodeForm(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.handleChange(makeChange("abcdef")));
        expect(result.current.code).toBe("ABCDEF");

        act(() => result.current.handleClear());
        expect(result.current.code).toBe("");
        expect(result.current.hasValue).toBe(false);
    });

    test("onError forwards the resolved key when the mutation fails", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.redeem.post
        ).mockResolvedValue({
            error: { value: { code: "SELF_REFERRAL" }, status: 409 },
        } as never);

        const onError = vi.fn();
        const { result } = renderHook(
            () => useRedeemReferralCodeForm({ onError }),
            { wrapper: queryWrapper.wrapper }
        );

        act(() => result.current.handleChange(makeChange("abcdef")));
        act(() => result.current.handleSubmit(makeSubmit()));

        await waitFor(() =>
            expect(onError).toHaveBeenCalledWith(
                "wallet.referral.redeem.errorSelf"
            )
        );
        expect(result.current.errorMessageKey).toBe(
            "wallet.referral.redeem.errorSelf"
        );
    });

    test("resetErrorOnChange clears mutation error on edit", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.redeem.post
        ).mockResolvedValue({
            error: { value: { code: "NOT_FOUND" }, status: 404 },
        } as never);

        const { result } = renderHook(() => useRedeemReferralCodeForm(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.handleChange(makeChange("wrong1")));
        act(() => result.current.handleSubmit(makeSubmit()));

        await waitFor(() =>
            expect(result.current.errorMessageKey).toBe(
                "wallet.referral.redeem.errorNotFound"
            )
        );

        act(() => result.current.handleChange(makeChange("wrong2")));
        await waitFor(() => expect(result.current.errorMessageKey).toBeNull());
    });
});

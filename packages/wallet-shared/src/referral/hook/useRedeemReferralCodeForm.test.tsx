import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { useRedeemReferralCodeForm } from "./useRedeemReferralCodeForm";

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));

vi.mock("../../common/analytics", () => ({ trackEvent }));

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

// Mocks are module-scoped on `authenticatedWalletApi`, so these depend on the
// workspace's in-file sequential execution: concurrent tests would race on
// `mockResolvedValue`.
describe("useRedeemReferralCodeForm", () => {
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
        ).mockResolvedValue({ data: { kind: "user" }, error: null } as never);

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

    test("context: onboarding is forwarded on submit", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.redeem.post
        ).mockResolvedValue({
            data: { kind: "frak" },
            error: null,
        } as never);

        const onApplied = vi.fn();
        const { result } = renderHook(
            () =>
                useRedeemReferralCodeForm({
                    onApplied,
                    context: "onboarding",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        act(() => result.current.handleChange(makeChange("frakpa")));
        act(() => result.current.handleSubmit(makeSubmit()));

        await waitFor(() =>
            expect(onApplied).toHaveBeenCalledWith({
                kind: "frak",
            })
        );
        expect(
            authenticatedWalletApi.referral.code.redeem.post
        ).toHaveBeenCalledWith({ code: "FRAKPA", context: "onboarding" });
    });

    test("no context by default", async ({ queryWrapper }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.redeem.post
        ).mockResolvedValue({ data: { kind: "user" }, error: null } as never);

        const { result } = renderHook(() => useRedeemReferralCodeForm(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.handleChange(makeChange("lola10")));
        act(() => result.current.handleSubmit(makeSubmit()));

        await waitFor(() =>
            expect(
                authenticatedWalletApi.referral.code.redeem.post
            ).toHaveBeenCalledWith({ code: "LOLA10", context: undefined })
        );
    });

    test("initialCode pre-fills without submitting", ({ queryWrapper }) => {
        const { result } = renderHook(
            () => useRedeemReferralCodeForm({ initialCode: "frakpa" }),
            { wrapper: queryWrapper.wrapper }
        );

        expect(result.current.code).toBe("FRAKPA");
        expect(
            authenticatedWalletApi.referral.code.redeem.post
        ).not.toHaveBeenCalled();
    });

    test("handlePaste reads the clipboard and fills the sanitised code", async ({
        queryWrapper,
    }) => {
        const readText = vi.fn().mockResolvedValue("fr-ak10");
        vi.stubGlobal("navigator", { ...navigator, clipboard: { readText } });

        const { result } = renderHook(() => useRedeemReferralCodeForm(), {
            wrapper: queryWrapper.wrapper,
        });

        await act(async () => {
            await result.current.handlePaste();
        });

        expect(result.current.code).toBe("FRAK10");
        vi.unstubAllGlobals();
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

    test("maps a 409 GAME_CLOSED error to the game closed key", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.redeem.post
        ).mockResolvedValue({
            error: { value: { code: "GAME_CLOSED" }, status: 409 },
        } as never);

        const { result } = renderHook(() => useRedeemReferralCodeForm(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.handleChange(makeChange("abcdef")));
        act(() => result.current.handleSubmit(makeSubmit()));

        await waitFor(() =>
            expect(result.current.errorMessageKey).toBe(
                "wallet.referral.redeem.errorGameClosed"
            )
        );
    });

    test("asks to confirm on FRAK_REFERRER without an inline error", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.redeem.post
        ).mockResolvedValue({
            error: { value: { code: "FRAK_REFERRER" }, status: 409 },
        } as never);

        const onError = vi.fn();
        const { result } = renderHook(
            () => useRedeemReferralCodeForm({ onError }),
            { wrapper: queryWrapper.wrapper }
        );

        act(() => result.current.handleChange(makeChange("lola10")));
        act(() => result.current.handleSubmit(makeSubmit()));

        await waitFor(() =>
            expect(result.current.confirmingFrakReplace).toBe(true)
        );
        expect(result.current.errorMessageKey).toBeNull();
        expect(onError).not.toHaveBeenCalled();
        expect(trackEvent).toHaveBeenCalledWith(
            "frak_referrer_replace_prompted"
        );
    });

    test("confirming resends the code with replaceFrakReferrer", async ({
        queryWrapper,
    }) => {
        vi.mocked(authenticatedWalletApi.referral.code.redeem.post)
            .mockResolvedValueOnce({
                error: { value: { code: "FRAK_REFERRER" }, status: 409 },
            } as never)
            .mockResolvedValueOnce({
                data: { kind: "user" },
                error: null,
            } as never);

        const onApplied = vi.fn();
        const { result } = renderHook(
            () => useRedeemReferralCodeForm({ onApplied }),
            { wrapper: queryWrapper.wrapper }
        );

        act(() => result.current.handleChange(makeChange("lola10")));
        act(() => result.current.handleSubmit(makeSubmit()));
        await waitFor(() =>
            expect(result.current.confirmingFrakReplace).toBe(true)
        );

        act(() => result.current.confirmFrakReplace());

        await waitFor(() =>
            expect(onApplied).toHaveBeenCalledWith({ kind: "user" })
        );
        expect(
            authenticatedWalletApi.referral.code.redeem.post
        ).toHaveBeenLastCalledWith({
            code: "LOLA10",
            context: undefined,
            replaceFrakReferrer: true,
        });
        expect(result.current.confirmingFrakReplace).toBe(false);
        expect(trackEvent).toHaveBeenCalledWith(
            "frak_referrer_replace_resolved",
            { outcome: "confirmed" }
        );
    });

    test("cancelling closes the confirmation and clears the error", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.redeem.post
        ).mockResolvedValue({
            error: { value: { code: "FRAK_REFERRER" }, status: 409 },
        } as never);

        const { result } = renderHook(() => useRedeemReferralCodeForm(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.handleChange(makeChange("lola10")));
        act(() => result.current.handleSubmit(makeSubmit()));
        await waitFor(() =>
            expect(result.current.confirmingFrakReplace).toBe(true)
        );

        act(() => result.current.cancelFrakReplace());

        await waitFor(() =>
            expect(result.current.confirmingFrakReplace).toBe(false)
        );
        expect(result.current.errorMessageKey).toBeNull();
        expect(
            authenticatedWalletApi.referral.code.redeem.post
        ).toHaveBeenCalledTimes(1);
        expect(trackEvent).toHaveBeenCalledWith(
            "frak_referrer_replace_resolved",
            { outcome: "cancelled" }
        );
    });

    test("keepFrakReferrer submits keeping Frak, with no confirmation", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.redeem.post
        ).mockResolvedValue({
            data: { kind: "user", game: { id: "g1" } },
            error: null,
        } as never);

        const onApplied = vi.fn();
        const { result } = renderHook(
            () =>
                useRedeemReferralCodeForm({
                    onApplied,
                    keepFrakReferrer: true,
                }),
            { wrapper: queryWrapper.wrapper }
        );

        act(() => result.current.handleChange(makeChange("lola10")));
        act(() => result.current.handleSubmit(makeSubmit()));

        await waitFor(() =>
            expect(onApplied).toHaveBeenCalledWith({
                kind: "user",
                game: { id: "g1" },
            })
        );
        expect(
            authenticatedWalletApi.referral.code.redeem.post
        ).toHaveBeenCalledExactlyOnceWith({
            code: "LOLA10",
            context: undefined,
            replaceFrakReferrer: false,
        });
        expect(result.current.confirmingFrakReplace).toBe(false);
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

    describe("onUnknownCode", () => {
        const mockNotFound = () =>
            vi
                .mocked(authenticatedWalletApi.referral.code.redeem.post)
                .mockResolvedValue({
                    error: { value: { code: "NOT_FOUND" }, status: 404 },
                } as never);

        test("a handled code clears the field with no error", async ({
            queryWrapper,
        }) => {
            mockNotFound();
            const onUnknownCode = vi.fn().mockResolvedValue("handled");
            const onError = vi.fn();
            const { result } = renderHook(
                () => useRedeemReferralCodeForm({ onUnknownCode, onError }),
                { wrapper: queryWrapper.wrapper }
            );

            act(() => result.current.handleChange(makeChange("abc234")));
            act(() => result.current.handleSubmit(makeSubmit()));

            await waitFor(() => expect(result.current.code).toBe(""));
            expect(onUnknownCode).toHaveBeenCalledWith("ABC234");
            expect(result.current.errorMessageKey).toBeNull();
            expect(result.current.isPending).toBe(false);
            expect(onError).not.toHaveBeenCalled();
        });

        test("stays pending and silent while the fallback runs", async ({
            queryWrapper,
        }) => {
            mockNotFound();
            let settle: (outcome: "unknown") => void = () => {};
            const onUnknownCode = vi.fn(
                () =>
                    new Promise<"unknown">((resolve) => {
                        settle = resolve;
                    })
            );
            const { result } = renderHook(
                () => useRedeemReferralCodeForm({ onUnknownCode }),
                { wrapper: queryWrapper.wrapper }
            );

            act(() => result.current.handleChange(makeChange("abc234")));
            act(() => result.current.handleSubmit(makeSubmit()));

            await waitFor(() => expect(onUnknownCode).toHaveBeenCalled());
            expect(result.current.isPending).toBe(true);
            expect(result.current.canSubmit).toBe(false);
            expect(result.current.errorMessageKey).toBeNull();

            await act(async () => settle("unknown"));
            expect(result.current.isPending).toBe(false);
        });

        test("an unknown code keeps the not-found message", async ({
            queryWrapper,
        }) => {
            mockNotFound();
            const onUnknownCode = vi.fn().mockResolvedValue("unknown");
            const onError = vi.fn();
            const { result } = renderHook(
                () => useRedeemReferralCodeForm({ onUnknownCode, onError }),
                { wrapper: queryWrapper.wrapper }
            );

            act(() => result.current.handleChange(makeChange("abc234")));
            act(() => result.current.handleSubmit(makeSubmit()));

            await waitFor(() =>
                expect(onError).toHaveBeenCalledWith(
                    "wallet.referral.redeem.errorNotFound"
                )
            );
            expect(result.current.errorMessageKey).toBe(
                "wallet.referral.redeem.errorNotFound"
            );
            expect(result.current.code).toBe("ABC234");
        });

        test("a rejected fallback is treated as unknown", async ({
            queryWrapper,
        }) => {
            mockNotFound();
            const onUnknownCode = vi
                .fn()
                .mockRejectedValue(new Error("network"));
            const { result } = renderHook(
                () => useRedeemReferralCodeForm({ onUnknownCode }),
                { wrapper: queryWrapper.wrapper }
            );

            act(() => result.current.handleChange(makeChange("abc234")));
            act(() => result.current.handleSubmit(makeSubmit()));

            await waitFor(() =>
                expect(result.current.errorMessageKey).toBe(
                    "wallet.referral.redeem.errorNotFound"
                )
            );
        });

        test("an error key replaces the not-found message until the next edit", async ({
            queryWrapper,
        }) => {
            mockNotFound();
            const onUnknownCode = vi
                .fn()
                .mockResolvedValue({ errorKey: "rewardCode.error.unresolved" });
            const onError = vi.fn();
            const { result } = renderHook(
                () => useRedeemReferralCodeForm({ onUnknownCode, onError }),
                { wrapper: queryWrapper.wrapper }
            );

            act(() => result.current.handleChange(makeChange("abc234")));
            act(() => result.current.handleSubmit(makeSubmit()));

            await waitFor(() =>
                expect(result.current.errorMessageKey).toBe(
                    "rewardCode.error.unresolved"
                )
            );
            expect(onError).toHaveBeenCalledWith("rewardCode.error.unresolved");

            act(() => result.current.handleChange(makeChange("abc235")));
            expect(result.current.errorMessageKey).toBeNull();
        });

        test("an answer landing after an edit is dropped", async ({
            queryWrapper,
        }) => {
            mockNotFound();
            let settle: (outcome: "handled") => void = () => {};
            const onUnknownCode = vi.fn(
                () =>
                    new Promise<"handled">((resolve) => {
                        settle = resolve;
                    })
            );
            const { result } = renderHook(
                () => useRedeemReferralCodeForm({ onUnknownCode }),
                { wrapper: queryWrapper.wrapper }
            );

            act(() => result.current.handleChange(makeChange("abc234")));
            act(() => result.current.handleSubmit(makeSubmit()));
            await waitFor(() => expect(onUnknownCode).toHaveBeenCalled());

            act(() => result.current.handleChange(makeChange("xyz789")));
            expect(result.current.isPending).toBe(false);

            await act(async () => settle("handled"));
            expect(result.current.code).toBe("XYZ789");
        });

        test("a 404 landing after an edit skips the fallback", async ({
            queryWrapper,
        }) => {
            let answer: (value: unknown) => void = () => {};
            vi.mocked(
                authenticatedWalletApi.referral.code.redeem.post
            ).mockImplementation(
                () =>
                    new Promise((resolve) => {
                        answer = resolve;
                    }) as never
            );
            const onUnknownCode = vi.fn();
            const onError = vi.fn();
            const { result } = renderHook(
                () => useRedeemReferralCodeForm({ onUnknownCode, onError }),
                { wrapper: queryWrapper.wrapper }
            );

            act(() => result.current.handleChange(makeChange("abc234")));
            act(() => result.current.handleSubmit(makeSubmit()));
            await waitFor(() => expect(result.current.isPending).toBe(true));

            act(() => result.current.handleChange(makeChange("xyz789")));
            await act(async () =>
                answer({
                    error: { value: { code: "NOT_FOUND" }, status: 404 },
                })
            );

            await waitFor(() => expect(result.current.isPending).toBe(false));
            expect(onUnknownCode).not.toHaveBeenCalled();
            expect(onError).not.toHaveBeenCalled();
            expect(result.current.code).toBe("XYZ789");
            expect(result.current.errorMessageKey).toBeNull();
        });

        test("other errors never reach the fallback", async ({
            queryWrapper,
        }) => {
            vi.mocked(
                authenticatedWalletApi.referral.code.redeem.post
            ).mockResolvedValue({
                error: { value: { code: "SELF_REFERRAL" }, status: 400 },
            } as never);
            const onUnknownCode = vi.fn();
            const { result } = renderHook(
                () => useRedeemReferralCodeForm({ onUnknownCode }),
                { wrapper: queryWrapper.wrapper }
            );

            act(() => result.current.handleChange(makeChange("abc234")));
            act(() => result.current.handleSubmit(makeSubmit()));

            await waitFor(() =>
                expect(result.current.errorMessageKey).toBe(
                    "wallet.referral.redeem.errorSelf"
                )
            );
            expect(onUnknownCode).not.toHaveBeenCalled();
        });
    });
});

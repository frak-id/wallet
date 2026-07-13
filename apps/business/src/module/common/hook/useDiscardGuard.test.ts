import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useTwoFactorStore } from "@/stores/twoFactorStore";
import { useDiscardGuard } from "./useDiscardGuard";

describe("useDiscardGuard", () => {
    beforeEach(() => {
        act(() => useTwoFactorStore.setState({ request: null }));
    });
    afterEach(() => {
        act(() => useTwoFactorStore.setState({ request: null }));
    });

    test("runs the action immediately when not dirty", () => {
        const action = vi.fn();
        const { result } = renderHook(() =>
            useDiscardGuard({ isDirty: false })
        );

        act(() => result.current.guard(action));

        expect(action).toHaveBeenCalledTimes(1);
        expect(result.current.dialogProps.open).toBe(false);
    });

    test("defers the action behind the discard dialog when dirty", () => {
        const action = vi.fn();
        const onDiscard = vi.fn();
        const { result } = renderHook(() =>
            useDiscardGuard({ isDirty: true, onDiscard })
        );

        act(() => result.current.guard(action));

        expect(action).not.toHaveBeenCalled();
        expect(result.current.dialogProps.open).toBe(true);

        act(() => result.current.dialogProps.onDiscard());

        expect(onDiscard).toHaveBeenCalledTimes(1);
        expect(action).toHaveBeenCalledTimes(1);
    });

    test("swallows close/discard while a 2FA challenge is live", () => {
        // Regression: the step-up TwoFactorModal is portaled outside the
        // guarded sheet, so clicking its input fires the sheet's
        // interact-outside close. The guard must ignore it (no discard dialog,
        // no action) instead of wiping the in-flight edit.
        const action = vi.fn();
        act(() =>
            useTwoFactorStore.setState({
                request: {
                    methods: ["totp"],
                    presentation: "modal",
                    resolve: () => {},
                },
            })
        );
        const { result } = renderHook(() => useDiscardGuard({ isDirty: true }));

        act(() => result.current.guard(action));

        expect(action).not.toHaveBeenCalled();
        expect(result.current.dialogProps.open).toBe(false);
    });
});

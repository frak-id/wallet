import type * as ReactRouter from "@tanstack/react-router";
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    enabled: { current: true },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
    ...(await importOriginal<typeof ReactRouter>()),
    useNavigate: () => mocks.navigate,
}));
vi.mock("@/module/monerium/utils/moneriumConfig", () => ({
    get isMoneriumEnabled() {
        return mocks.enabled.current;
    },
}));

import { useOpenMoneriumFromLink } from "./useOpenMoneriumFromLink";

describe("useOpenMoneriumFromLink", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.enabled.current = true;
        modalStore.getState().dismissAll();
    });

    test("opens the bank flow once and strips the param", () => {
        const { rerender } = renderHook(() =>
            useOpenMoneriumFromLink("monerium")
        );
        rerender();

        expect(modalStore.getState().modal).toEqual({
            id: "moneriumBankFlow",
        });
        expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({
            to: "/wallet",
            search: {},
            replace: true,
        });
    });

    test("still strips the param but opens nothing while Monerium is disabled", () => {
        mocks.enabled.current = false;
        renderHook(() => useOpenMoneriumFromLink("monerium"));

        expect(modalStore.getState().modal).toBeNull();
        expect(mocks.navigate).toHaveBeenCalledOnce();
    });

    test("does nothing without the param", () => {
        renderHook(() => useOpenMoneriumFromLink(undefined));

        expect(modalStore.getState().modal).toBeNull();
        expect(mocks.navigate).not.toHaveBeenCalled();
    });
});

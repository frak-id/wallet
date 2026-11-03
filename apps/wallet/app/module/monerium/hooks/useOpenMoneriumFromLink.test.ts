import type * as ReactRouter from "@tanstack/react-router";
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
    ...(await importOriginal<typeof ReactRouter>()),
    useNavigate: () => mocks.navigate,
}));

import { useOpenMoneriumFromLink } from "./useOpenMoneriumFromLink";

describe("useOpenMoneriumFromLink", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    test("does nothing without the param", () => {
        renderHook(() => useOpenMoneriumFromLink(undefined));

        expect(modalStore.getState().modal).toBeNull();
        expect(mocks.navigate).not.toHaveBeenCalled();
    });
});

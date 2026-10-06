import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import type { RewardHistoryItem } from "@frak-labs/wallet-shared";
import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import type { MoneriumOrder } from "@/module/monerium/utils/moneriumTypes";
import { modalStore } from "@/module/stores/modalStore";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

const { invokeMock, recordErrorMock, isIosMock, isTauriMock } = vi.hoisted(
    () => ({
        invokeMock: vi.fn(),
        recordErrorMock: vi.fn(),
        isIosMock: vi.fn(),
        isTauriMock: vi.fn(),
    })
);

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_IOS() {
        return isIosMock();
    },
    get IS_TAURI() {
        return isTauriMock();
    },
    IS_ANDROID: false,
    isStandalonePwa: () => false,
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        getInvoke: vi.fn(async () => invokeMock),
        recordError: recordErrorMock,
    };
});

import { useNativeSwipeBackGate } from "./useNativeSwipeBackGate";

const explorerDetail = {
    id: "explorerDetail",
    merchant: { id: "m1" } as ExplorerMerchantItem,
} as const;
const rewardDetail = {
    id: "rewardDetail",
    item: { merchant: { id: "m1" } } as RewardHistoryItem,
} as const;
const moneriumOrderDetail = {
    id: "moneriumOrderDetail",
    order: {} as MoneriumOrder,
} as const;

const store = () => modalStore.getState();

/** The command resolves on a later microtask, so state changes run in an async `act`. */
async function run(action: () => void) {
    await act(async () => {
        action();
    });
}

function toggles() {
    return invokeMock.mock.calls.map(([command, args]) => [command, args]);
}

describe("useNativeSwipeBackGate", () => {
    let unmount: () => void;

    beforeEach(async () => {
        isIosMock.mockReturnValue(true);
        isTauriMock.mockReturnValue(true);
        invokeMock.mockResolvedValue(undefined);
        store().dismissAll();
        await run(() => {
            ({ unmount } = renderHook(() => useNativeSwipeBackGate()));
        });
        invokeMock.mockClear();
    });

    afterEach(() => {
        unmount();
        store().dismissAll();
        vi.clearAllMocks();
    });

    test("asserts the native state on mount, since it can outlive a reload", async () => {
        unmount();
        await run(() => {
            ({ unmount } = renderHook(() => useNativeSwipeBackGate()));
        });

        expect(toggles()).toEqual([
            ["set_swipe_back_enabled", { enabled: true }],
        ]);
    });

    test("disables on opening explorerDetail and re-enables on closing it", async () => {
        await run(() => store().openModal(explorerDetail));
        expect(toggles()).toEqual([
            ["set_swipe_back_enabled", { enabled: false }],
        ]);

        await run(() => store().closeModal());
        expect(toggles()).toEqual([
            ["set_swipe_back_enabled", { enabled: false }],
            ["set_swipe_back_enabled", { enabled: true }],
        ]);
    });

    test.each([
        ["rewardDetail", rewardDetail],
        ["moneriumOrderDetail", moneriumOrderDetail],
        ["welcomeDetail", { id: "welcomeDetail" } as const],
    ])("disables for %s", async (_id, modal) => {
        await run(() => store().openModal(modal));
        expect(toggles()).toEqual([
            ["set_swipe_back_enabled", { enabled: false }],
        ]);
    });

    test.each([
        ["moneriumBankFlow", { id: "moneriumBankFlow" } as const],
        [
            "editReferralCode",
            { id: "editReferralCode", onSaved: () => {} } as const,
        ],
        ["reauth", { id: "reauth", reason: "grace" } as const],
    ])("does not invoke anything for %s", async (_id, modal) => {
        await run(() => store().openModal(modal));
        expect(invokeMock).not.toHaveBeenCalled();
    });

    test("a reauth modal on top of an overlay re-enables, closing it disables again", async () => {
        await run(() => store().openModal(explorerDetail));
        await run(() => store().openModal({ id: "reauth", reason: "grace" }));
        await run(() => store().closeModal());

        expect(toggles().map(([, args]) => args)).toEqual([
            { enabled: false },
            { enabled: true },
            { enabled: false },
        ]);
    });

    test("dismissAll while an overlay is open re-enables", async () => {
        await run(() => store().openModal(explorerDetail));
        await run(() => store().dismissAll());

        expect(invokeMock).toHaveBeenLastCalledWith("set_swipe_back_enabled", {
            enabled: true,
        });
    });

    test("re-opening the same overlay after closing toggles again", async () => {
        await run(() => store().openModal(explorerDetail));
        await run(() => store().closeModal());
        await run(() => store().openModal(explorerDetail));

        expect(toggles().map(([, args]) => args)).toEqual([
            { enabled: false },
            { enabled: true },
            { enabled: false },
        ]);
    });

    test("opening another overlay over an overlay makes no extra call", async () => {
        await run(() => store().openModal(explorerDetail));
        await run(() => store().openModal(rewardDetail));

        expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    test("a rejected disable is recorded and leaves the gesture enabled", async () => {
        const failure = new Error("native unavailable");
        invokeMock.mockRejectedValueOnce(failure);

        await run(() => store().openModal(explorerDetail));
        expect(recordErrorMock).toHaveBeenCalledWith(
            failure,
            expect.anything()
        );

        await run(() => store().closeModal());
        expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    test("a rejected enable is recorded and retried on the next modal change", async () => {
        await run(() => store().openModal(explorerDetail));
        const failure = new Error("native unavailable");
        invokeMock.mockRejectedValueOnce(failure);
        await run(() => store().closeModal());
        expect(recordErrorMock).toHaveBeenCalledWith(
            failure,
            expect.anything()
        );

        await run(() => store().openModal({ id: "reauth", reason: "grace" }));

        expect(toggles().map(([, args]) => args)).toEqual([
            { enabled: false },
            { enabled: true },
            { enabled: true },
        ]);
    });

    test("a rejected enable is retried when the app returns to the foreground", async () => {
        await run(() => store().openModal(explorerDetail));
        invokeMock.mockRejectedValueOnce(new Error("native unavailable"));
        await run(() => store().closeModal());

        await run(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });

        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock).toHaveBeenLastCalledWith("set_swipe_back_enabled", {
            enabled: true,
        });
    });

    test("returning to the foreground makes no call when the state matches", async () => {
        await run(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });

        expect(invokeMock).not.toHaveBeenCalled();
    });

    test("closing the overlay before a pending disable settles ends enabled", async () => {
        let settle: () => void = () => {};
        invokeMock.mockImplementationOnce(
            () => new Promise<void>((resolve) => (settle = resolve))
        );

        await run(() => store().openModal(explorerDetail));
        await run(() => store().closeModal());
        await run(() => settle());

        expect(invokeMock).toHaveBeenLastCalledWith("set_swipe_back_enabled", {
            enabled: true,
        });
    });

    test("never invokes the toggle when not on iOS", async () => {
        isIosMock.mockReturnValue(false);

        await run(() => store().openModal(explorerDetail));
        await run(() => store().closeModal());

        expect(invokeMock).not.toHaveBeenCalled();
    });
});

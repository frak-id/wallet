import { RpcErrorCodes } from "@frak-labs/frame-connector";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { WalletRpcContext } from "@/module/types/context";
import type { UIRequest } from "@/ui/ListenerUiProvider";

const chunks = vi.hoisted(() => {
    const gate = () => {
        let open: () => void = () => {};
        let loaded = Promise.resolve();
        return {
            hold: () => {
                loaded = new Promise<void>((resolve) => {
                    open = resolve;
                });
            },
            wait: () => loaded,
            open: () => open(),
        };
    };
    return { modal: gate(), sharing: gate() };
});

vi.mock("@/uiRuntime", () => ({ ensureUiRuntime: vi.fn() }));

vi.mock("@frak-labs/wallet-shared/stores/sessionStore", () => ({
    sessionStore: { getState: () => ({ session: null }) },
}));

vi.mock("@frak-labs/wallet-shared/common/analytics", () => ({
    trackEvent: vi.fn(),
}));

// A module loads once per test file, so each held handler stands in for a slow chunk.
vi.mock("@/module/modal/component/Modal", async () => {
    const impl = await import("./useDisplayModalListener.impl");
    return {
        handleDisplayModal: async (
            ...args: Parameters<typeof impl.handleDisplayModal>
        ) => {
            await chunks.modal.wait();
            return impl.handleDisplayModal(...args);
        },
    };
});

vi.mock("@/module/sharing/component/SharingPage", async () => {
    const impl = await import("./useDisplaySharingPageListener.impl");
    return {
        handleDisplaySharingPage: async (
            ...args: Parameters<typeof impl.handleDisplaySharingPage>
        ) => {
            await chunks.sharing.wait();
            return impl.handleDisplaySharingPage(...args);
        },
    };
});

const { uiBus } = await import("@/uiBus");
const { createDisplayModalHandler } = await import("./useDisplayModalListener");
const { createDisplaySharingPageHandler } = await import(
    "./useDisplaySharingPageListener"
);

const track = <T>(call: Promise<T>) => {
    const state: { ended?: { result: T } | { error: unknown } } = {};
    call.then(
        (result) => {
            state.ended = { result };
        },
        (error: unknown) => {
            state.ended = { error };
        }
    );
    return state;
};

const context: WalletRpcContext = {
    origin: "https://merchant.test",
    source: null,
    merchantId: "merchant",
    sourceUrl: "https://merchant.test/",
};
const modalParams: Parameters<ReturnType<typeof createDisplayModalHandler>>[0] =
    [{ final: { action: { key: "reward" } } }, undefined, { name: "Merchant" }];
const sharingParams: Parameters<
    ReturnType<typeof createDisplaySharingPageHandler>
>[0] = [{}, { name: "Merchant" }];

let handler = vi.fn<(request: UIRequest) => void>();
let detach = () => {};

beforeEach(() => {
    handler = vi.fn();
    detach = uiBus.attach(handler);
});

afterEach(() => {
    detach();
});

it("keeps a sharing page on screen when a modal that arrived before it finishes loading its code after it", async () => {
    chunks.modal.hold();
    const modal = track(createDisplayModalHandler()(modalParams, context));
    const sharing = track(
        createDisplaySharingPageHandler()(sharingParams, context)
    );
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(handler.mock.calls[0][0].type).toBe("sharing");

    chunks.modal.open();
    await vi.waitFor(() => expect(modal.ended ?? sharing.ended).toBeDefined());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(sharing.ended).toBeUndefined();
    expect(modal.ended).toMatchObject({
        error: { code: RpcErrorCodes.internalError },
    });
});

it("keeps a modal on screen when a sharing page that arrived before it finishes loading its code after it", async () => {
    chunks.sharing.hold();
    const sharing = track(
        createDisplaySharingPageHandler()(sharingParams, context)
    );
    const modal = track(createDisplayModalHandler()(modalParams, context));
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(handler.mock.calls[0][0].type).toBe("modal");

    chunks.sharing.open();
    await vi.waitFor(() => expect(sharing.ended ?? modal.ended).toBeDefined());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(modal.ended).toBeUndefined();
    expect(sharing.ended).toMatchObject({
        error: { code: RpcErrorCodes.internalError },
    });
});

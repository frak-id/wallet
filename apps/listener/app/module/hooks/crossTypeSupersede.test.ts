import { RpcErrorCodes } from "@frak-labs/frame-connector";
import type { FreshSdkResult } from "@frak-labs/wallet-shared/common/auth/ensureFreshSdkSession";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UIRequest } from "@/ui/ListenerUiProvider";

const sessionHolder = vi.hoisted(
    (): { session: { address: string } | null } => ({ session: null })
);

vi.mock("@frak-labs/wallet-shared/stores/sessionStore", () => ({
    sessionStore: { getState: () => ({ session: sessionHolder.session }) },
}));

vi.mock("@frak-labs/wallet-shared/common/auth/ensureFreshSdkSession", () => ({
    ensureFreshSdkSession: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/common/analytics", () => ({
    trackEvent: vi.fn(),
}));

const { ensureFreshSdkSession } = await import(
    "@frak-labs/wallet-shared/common/auth/ensureFreshSdkSession"
);
const { uiBus } = await import("@/uiBus");
const { handleDisplayModal } = await import("./useDisplayModalListener.impl");
const { handleDisplaySharingPage } = await import(
    "./useDisplaySharingPageListener.impl"
);

type ModalParams = Parameters<typeof handleDisplayModal>[0];
type SharingParams = Parameters<typeof handleDisplaySharingPage>[0];

const modalParams: ModalParams = [
    { login: {} },
    undefined,
    { name: "Test merchant" },
];
const sharingParams: SharingParams = [{}, { name: "Test merchant" }];

const deps = { setRequest: uiBus.request };

// Records how a call ended so a hang shows up as a failed assertion, not a timeout.
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

const shown = (handler: (request: UIRequest) => void, index: number) => {
    const request = vi.mocked(handler).mock.calls[index]?.[0];
    if (!request) throw new Error(`no request shown at ${index}`);
    return request;
};

let detach = () => {};
let handler = vi.fn<(request: UIRequest) => void>();

beforeEach(() => {
    handler = vi.fn();
    detach = uiBus.attach(handler);
});

afterEach(() => {
    detach();
    sessionHolder.session = null;
    vi.mocked(ensureFreshSdkSession).mockReset();
});

describe("a request replaced on screen by a newer one", () => {
    it("rejects a pending modal when a sharing page replaces it", async () => {
        const modal = track(handleDisplayModal(modalParams, deps));
        await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));

        const sharing = track(handleDisplaySharingPage(sharingParams, deps));
        await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));

        await vi.waitFor(() =>
            expect(modal.ended).toMatchObject({
                error: { code: RpcErrorCodes.internalError },
            })
        );

        const sharingRequest = shown(handler, 1);
        if (sharingRequest.type !== "sharing") throw new Error("not sharing");
        await sharingRequest.emitter({ result: { action: "copied" } });
        await vi.waitFor(() =>
            expect(sharing.ended).toEqual({ result: { action: "copied" } })
        );
    });

    it("rejects a pending sharing page when another sharing page replaces it", async () => {
        const first = track(handleDisplaySharingPage(sharingParams, deps));
        await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));

        const second = track(handleDisplaySharingPage(sharingParams, deps));
        await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));

        await vi.waitFor(() =>
            expect(first.ended).toMatchObject({
                error: { code: RpcErrorCodes.internalError },
            })
        );

        const secondRequest = shown(handler, 1);
        if (secondRequest.type !== "sharing") throw new Error("not sharing");
        await secondRequest.emitter({ result: { action: "copied" } });
        await vi.waitFor(() =>
            expect(second.ended).toEqual({ result: { action: "copied" } })
        );
    });

    it("rejects a pending sharing page when a modal replaces it", async () => {
        const sharing = track(handleDisplaySharingPage(sharingParams, deps));
        await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));

        const modal = track(handleDisplayModal(modalParams, deps));
        await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));

        await vi.waitFor(() =>
            expect(sharing.ended).toMatchObject({
                error: { code: RpcErrorCodes.internalError },
            })
        );

        const modalRequest = shown(handler, 1);
        if (modalRequest.type !== "modal") throw new Error("not modal");
        await modalRequest.emitter({
            error: { code: RpcErrorCodes.clientAborted, message: "closed" },
        });
        await vi.waitFor(() =>
            expect(modal.ended).toMatchObject({
                error: { code: RpcErrorCodes.clientAborted },
            })
        );
    });

    it("keeps a sharing page on screen when an older modal finishes its refresh after it", async () => {
        sessionHolder.session = { address: "0x1" };
        let finishRefresh: (result: FreshSdkResult) => void = () => {};
        vi.mocked(ensureFreshSdkSession).mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishRefresh = resolve;
                })
        );

        const modal = track(
            handleDisplayModal(
                [
                    { login: {}, final: { action: { key: "reward" } } },
                    undefined,
                    { name: "Test merchant" },
                ],
                deps
            )
        );
        await vi.waitFor(() =>
            expect(ensureFreshSdkSession).toHaveBeenCalledTimes(1)
        );

        const sharing = track(handleDisplaySharingPage(sharingParams, deps));
        await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
        const sharingRequest = shown(handler, 0);
        if (sharingRequest.type !== "sharing") throw new Error("not sharing");

        finishRefresh({ status: "stale", sdk: null });
        await vi.waitFor(() =>
            expect(modal.ended).toMatchObject({
                error: { code: RpcErrorCodes.internalError },
            })
        );

        expect(handler).toHaveBeenCalledTimes(1);
        expect(sharing.ended).toBeUndefined();

        await sharingRequest.emitter({ result: { action: "copied" } });
        await vi.waitFor(() =>
            expect(sharing.ended).toEqual({ result: { action: "copied" } })
        );
    });
});

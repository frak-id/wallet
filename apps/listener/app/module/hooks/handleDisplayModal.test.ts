import { RpcErrorCodes } from "@frak-labs/frame-connector";
import type { FreshSdkResult } from "@frak-labs/wallet-shared/common/auth/ensureFreshSdkSession";
import { afterEach, describe, expect, it, vi } from "vitest";
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

type Params = Parameters<typeof handleDisplayModal>[0];
const params: Params = [{ login: {} }, undefined, { name: "Test merchant" }];

// What the eager shell does on arrival, before the handler's code loads.
const arrive = (setRequest: (request: UIRequest) => void) => ({
    setRequest,
    isLatest: uiBus.claim(),
});

afterEach(() => {
    sessionHolder.session = null;
    vi.mocked(ensureFreshSdkSession).mockReset();
});

describe("handleDisplayModal", () => {
    it("rejects the pending request when a new one replaces it", async () => {
        const setRequest = vi.fn();
        const first = handleDisplayModal(params, arrive(setRequest));
        await vi.waitFor(() => expect(setRequest).toHaveBeenCalledTimes(1));

        const second = handleDisplayModal(params, arrive(setRequest));

        await expect(first).rejects.toMatchObject({
            code: RpcErrorCodes.internalError,
        });
        await vi.waitFor(() => expect(setRequest).toHaveBeenCalledTimes(2));

        const secondRequest = setRequest.mock.calls[1][0];
        await secondRequest.emitter({
            error: { code: RpcErrorCodes.clientAborted, message: "closed" },
        });
        await expect(second).rejects.toMatchObject({
            code: RpcErrorCodes.clientAborted,
        });
    });

    it("rejects the displayed request when a newer one has no steps", async () => {
        const setRequest = vi.fn();
        const first = handleDisplayModal(params, arrive(setRequest));
        await vi.waitFor(() => expect(setRequest).toHaveBeenCalledTimes(1));

        const empty = handleDisplayModal(
            [{}, undefined, {}],
            arrive(setRequest)
        );

        await expect(empty).rejects.toMatchObject({
            code: RpcErrorCodes.invalidRequest,
        });
        await expect(first).rejects.toMatchObject({
            code: RpcErrorCodes.internalError,
        });
    });

    it("keeps the displayed modal live while a newer request refreshes", async () => {
        const setRequest = vi.fn();
        const first = handleDisplayModal(params, arrive(setRequest));
        await vi.waitFor(() => expect(setRequest).toHaveBeenCalledTimes(1));

        sessionHolder.session = { address: "0x1" };
        let finishRefresh: (result: FreshSdkResult) => void = () => {};
        vi.mocked(ensureFreshSdkSession).mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishRefresh = resolve;
                })
        );
        const second = handleDisplayModal(
            [
                { login: {}, final: { action: { key: "reward" } } },
                undefined,
                { name: "Newer merchant" },
            ],
            arrive(setRequest)
        );
        await vi.waitFor(() =>
            expect(ensureFreshSdkSession).toHaveBeenCalledTimes(1)
        );

        await setRequest.mock.calls[0][0].emitter({
            result: { login: { wallet: "0x1" } },
        });
        await expect(first).resolves.toEqual({ login: { wallet: "0x1" } });

        finishRefresh({ status: "stale", sdk: null });
        await vi.waitFor(() => expect(setRequest).toHaveBeenCalledTimes(2));
        await setRequest.mock.calls[1][0].emitter({
            result: { login: { wallet: "0x2" } },
        });
        await expect(second).resolves.toEqual({ login: { wallet: "0x2" } });
    });

    it("resolves a login-only modal at once for a logged-in user", async () => {
        sessionHolder.session = { address: "0xabc" };
        vi.mocked(ensureFreshSdkSession).mockResolvedValue({
            status: "stale",
            sdk: null,
        });
        const setRequest = vi.fn();

        await expect(
            handleDisplayModal(params, arrive(setRequest))
        ).resolves.toEqual({ login: { wallet: "0xabc" } });
        expect(setRequest).not.toHaveBeenCalled();
    });

    it("leaves the displayed modal live when a login-only request resolves at once", async () => {
        const setRequest = vi.fn();
        const displayed = handleDisplayModal(params, arrive(setRequest));
        await vi.waitFor(() => expect(setRequest).toHaveBeenCalledTimes(1));

        sessionHolder.session = { address: "0xabc" };
        vi.mocked(ensureFreshSdkSession).mockResolvedValue({
            status: "stale",
            sdk: null,
        });
        await expect(
            handleDisplayModal(params, arrive(setRequest))
        ).resolves.toEqual({ login: { wallet: "0xabc" } });
        expect(setRequest).toHaveBeenCalledTimes(1);

        await setRequest.mock.calls[0][0].emitter({
            result: { login: { wallet: "0xdef" } },
        });
        await expect(displayed).resolves.toEqual({
            login: { wallet: "0xdef" },
        });
    });

    it.each([
        { resolvesFirst: "earlier", order: [0, 1] },
        { resolvesFirst: "newer", order: [1, 0] },
    ])(
        "rejects a request replaced during the session refresh ($resolvesFirst refresh resolves first)",
        async ({ order }) => {
            sessionHolder.session = { address: "0x1" };
            const refreshes: Array<(result: FreshSdkResult) => void> = [];
            vi.mocked(ensureFreshSdkSession).mockImplementation(
                () =>
                    new Promise((resolve) => {
                        refreshes.push(resolve);
                    })
            );
            const steps: Params[0] = {
                login: {},
                final: { action: { key: "reward" } },
            };
            const olderParams: Params = [
                steps,
                undefined,
                { name: "Older merchant" },
            ];
            const newerParams: Params = [
                steps,
                undefined,
                { name: "Newer merchant" },
            ];
            const setRequest = vi.fn();

            const first = handleDisplayModal(olderParams, arrive(setRequest));
            const firstOutcome = first.then(
                () => undefined,
                (error: unknown) => error
            );
            await vi.waitFor(() => expect(refreshes).toHaveLength(1));
            const second = handleDisplayModal(newerParams, arrive(setRequest));
            await vi.waitFor(() => expect(refreshes).toHaveLength(2));

            for (const index of order) {
                refreshes[index]({ status: "stale", sdk: null });
            }

            await vi.waitFor(() => expect(setRequest).toHaveBeenCalledTimes(1));
            expect(setRequest).toHaveBeenCalledWith(
                expect.objectContaining({ configMetadata: newerParams[2] })
            );
            expect(await firstOutcome).toMatchObject({
                code: RpcErrorCodes.internalError,
            });

            await setRequest.mock.calls[0][0].emitter({
                result: { login: { wallet: "0x1" } },
            });
            await expect(second).resolves.toEqual({
                login: { wallet: "0x1" },
            });
            expect(setRequest).toHaveBeenCalledTimes(1);
        }
    );
});

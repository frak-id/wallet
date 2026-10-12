import { RpcErrorCodes } from "@frak-labs/frame-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import i18next from "i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ListenerUiProvider, type UIRequest } from "@/ui/ListenerUiProvider";
import { ListenerUiRenderer } from "@/ui/ListenerUiRenderer";
import { uiBus } from "@/uiBus";

const crash = vi.hoisted(() => ({ next: false }));
const recordError = vi.hoisted(() => vi.fn());
const i18n = vi.hoisted(() => ({ instance: undefined as unknown }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ i18n: i18n.instance }),
}));

vi.mock("@/module/modal/component/Modal", () => ({
    ListenerModal: () => {
        if (crash.next) throw new Error("modal render crash");
        return <p>modal content</p>;
    },
}));

vi.mock(
    "@frak-labs/wallet-shared/common/analytics",
    async (importOriginal) => ({
        ...(await importOriginal<object>()),
        recordError,
    })
);

beforeAll(async () => {
    const instance = i18next.createInstance();
    i18n.instance = instance;
    await instance.init({
        lng: "en",
        ns: ["customized", "common"],
        resources: {},
    });
});

function modalRequest(emitter: () => Promise<void>): UIRequest {
    return {
        type: "modal",
        appName: "Test merchant",
        metadata: {},
        steps: { login: {} },
        configMetadata: { name: "Test merchant" },
        emitter,
    };
}

describe("ListenerUiRenderer", () => {
    it("settles a request whose UI crashes, hides the iframe, then renders the next request", async () => {
        const postMessage = vi.spyOn(window.parent, "postMessage");
        render(
            <QueryClientProvider client={new QueryClient()}>
                <ListenerUiProvider>
                    <ListenerUiRenderer />
                </ListenerUiProvider>
            </QueryClientProvider>
        );

        crash.next = true;
        const crashedEmitter = vi.fn(async () => {});
        act(() => uiBus.request(modalRequest(crashedEmitter)));

        await waitFor(() =>
            expect(crashedEmitter).toHaveBeenCalledWith({
                error: expect.objectContaining({
                    code: RpcErrorCodes.serverError,
                }),
            })
        );
        expect(postMessage).toHaveBeenCalledWith(
            { iframeLifecycle: "hide" },
            "*"
        );
        expect(recordError).toHaveBeenCalledWith(
            expect.objectContaining({ message: "modal render crash" }),
            expect.objectContaining({ source: "error_boundary" })
        );

        crash.next = false;
        const nextEmitter = vi.fn(async () => {});
        act(() => uiBus.request(modalRequest(nextEmitter)));

        expect(await screen.findByText("modal content")).toBeInTheDocument();
        expect(nextEmitter).not.toHaveBeenCalled();
    });
});

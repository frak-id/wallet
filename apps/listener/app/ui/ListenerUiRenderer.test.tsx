import { RpcErrorCodes } from "@frak-labs/frame-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import i18next from "i18next";
import { useEffect } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
    ListenerUiProvider,
    type UIRequest,
    useListenerUI,
} from "@/ui/ListenerUiProvider";
import { ListenerUiRenderer } from "@/ui/ListenerUiRenderer";
import { uiBus } from "@/uiBus";

const crash = vi.hoisted(() => ({ next: false, onUnmount: false }));
const recordError = vi.hoisted(() => vi.fn());
const i18n = vi.hoisted(() => ({ instance: undefined as unknown }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ i18n: i18n.instance }),
}));

vi.mock("@/module/modal/component/Modal", () => ({
    ListenerModal: () => {
        const { clearRequest } = useListenerUI();
        useEffect(
            () => () => {
                if (crash.onUnmount) throw new Error("modal unmount crash");
            },
            []
        );
        if (crash.next) throw new Error("modal render crash");
        return (
            <button type="button" onClick={clearRequest}>
                modal content
            </button>
        );
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

function renderListener() {
    render(
        <QueryClientProvider client={new QueryClient()}>
            <ListenerUiProvider>
                <ListenerUiRenderer />
            </ListenerUiProvider>
        </QueryClientProvider>
    );
}

describe("ListenerUiRenderer", () => {
    it("settles a request whose UI crashes, hides the iframe, then renders the next request", async () => {
        const postMessage = vi.spyOn(window.parent, "postMessage");
        renderListener();

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

    it("records a crash that happens after its request was cleared", async () => {
        recordError.mockClear();
        renderListener();
        crash.onUnmount = true;
        const emitter = vi.fn(async () => {});
        act(() => uiBus.request(modalRequest(emitter)));

        fireEvent.click(await screen.findByText("modal content"));

        await waitFor(() =>
            expect(recordError).toHaveBeenCalledWith(
                expect.objectContaining({ message: "modal unmount crash" }),
                expect.objectContaining({ source: "error_boundary" })
            )
        );
        expect(emitter).not.toHaveBeenCalled();
        crash.onUnmount = false;
    });
});

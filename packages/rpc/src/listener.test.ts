import type { Mock } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RpcListener } from "./listener";
import { createRpcListener } from "./listener";
import type { RpcSchemaEntry } from "./rpc-schema";
import type { RpcMiddleware, RpcMiddlewareContext } from "./types";

// Minimal schema exercising a single promise-based method
type TestSchema = readonly [
    RpcSchemaEntry<"frak_ping", { name: string }, string>,
];

type PostMessageMock = Mock<
    (message: unknown, options?: { targetOrigin: string }) => void
>;

type SourceStub = { postMessage: PostMessageMock };

function createSourceStub(): SourceStub {
    return { postMessage: vi.fn() };
}

function dispatch(origin: string, data: unknown, source: SourceStub) {
    window.dispatchEvent(
        new MessageEvent("message", {
            origin,
            data,
            source: source as unknown as MessageEventSource,
        })
    );
}

/**
 * Let an admitted message finish its trip: the handler is reached after the
 * middleware and dispatch awaits, and the response is posted a task later.
 * A negative assertion is meaningless without this.
 */
async function flushAsyncDispatch() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

const MERCHANT_ORIGIN = "https://merchant.example";
const OTHER_ORIGIN = "https://evil.example";

describe("createRpcListener", () => {
    let activeListener:
        | RpcListener<TestSchema, Record<string, never>>
        | undefined;

    afterEach(() => {
        activeListener?.cleanup();
        activeListener = undefined;
    });

    // `handleMessage` is async: an admitted message only reaches its handler
    // a couple of microtasks later, and posts its response a macrotask after
    // that. Flushing both is what makes this negative assertion mean anything.
    it("does not run any handler or post a response for a disallowed origin", async () => {
        const listener = createRpcListener<TestSchema>({
            transport: window,
            allowedOrigins: [MERCHANT_ORIGIN],
        });
        activeListener = listener;

        const handler = vi.fn(async () => "pong");
        listener.handle("frak_ping", handler);

        const source = createSourceStub();
        dispatch(
            OTHER_ORIGIN,
            { id: "1", topic: "frak_ping", data: { name: "world" } },
            source
        );
        await flushAsyncDispatch();

        expect(handler).not.toHaveBeenCalled();
        expect(source.postMessage).not.toHaveBeenCalled();
    });

    it("delivers an RPC message to its handler for an allowed origin", async () => {
        const listener = createRpcListener<TestSchema>({
            transport: window,
            allowedOrigins: [MERCHANT_ORIGIN],
        });
        activeListener = listener;

        const handler = vi.fn(
            async (
                params: { name: string } | undefined,
                _context: RpcMiddlewareContext<Record<string, never>>
            ) => `pong ${params?.name}`
        );
        listener.handle("frak_ping", handler);

        const source = createSourceStub();
        dispatch(
            MERCHANT_ORIGIN,
            { id: "1", topic: "frak_ping", data: { name: "world" } },
            source
        );
        await vi.waitFor(() => expect(handler).toHaveBeenCalled());

        expect(handler).toHaveBeenCalledWith(
            { name: "world" },
            expect.objectContaining({ origin: MERCHANT_ORIGIN })
        );
        expect(source.postMessage).toHaveBeenCalledWith(
            { id: "1", topic: "frak_ping", data: { result: "pong world" } },
            { targetOrigin: MERCHANT_ORIGIN }
        );
    });

    it("admits any origin when the allow-list contains a wildcard", async () => {
        const listener = createRpcListener<TestSchema>({
            transport: window,
            allowedOrigins: ["*"],
        });
        activeListener = listener;

        const handler = vi.fn(async () => "pong");
        listener.handle("frak_ping", handler);

        const source = createSourceStub();
        dispatch(
            OTHER_ORIGIN,
            { id: "1", topic: "frak_ping", data: { name: "world" } },
            source
        );
        await vi.waitFor(() => expect(handler).toHaveBeenCalled());

        expect(source.postMessage).toHaveBeenCalledWith(
            { id: "1", topic: "frak_ping", data: { result: "pong" } },
            { targetOrigin: OTHER_ORIGIN }
        );
    });

    it("keeps a credential-bearing lifecycle message from reaching a disallowed origin", () => {
        const iframeLifecycle = vi.fn(
            (
                _event: unknown,
                context: { source: MessageEventSource | null }
            ) => {
                (context.source as unknown as SourceStub)?.postMessage({
                    iframeLifecycle: "session-established",
                    data: { sessionToken: "secret-token" },
                });
            }
        );

        const listener = createRpcListener<TestSchema>({
            transport: window,
            allowedOrigins: [MERCHANT_ORIGIN],
            lifecycleHandlers: { iframeLifecycle },
        });
        activeListener = listener;

        const source = createSourceStub();
        dispatch(
            OTHER_ORIGIN,
            {
                iframeLifecycle: "session-established",
                data: { sessionToken: "secret-token" },
            },
            source
        );

        expect(iframeLifecycle).not.toHaveBeenCalled();
        expect(source.postMessage).not.toHaveBeenCalled();
    });

    it("routes a lifecycle message to its handler and bypasses middleware", async () => {
        const callOrder: string[] = [];
        const middleware: RpcMiddleware<TestSchema> = {
            onRequest: (_message, context) => {
                callOrder.push("middleware");
                return context;
            },
        };
        const iframeLifecycle = vi.fn(
            (
                _event: unknown,
                context: { source: MessageEventSource | null }
            ) => {
                callOrder.push("lifecycle");
                (context.source as unknown as SourceStub)?.postMessage({
                    iframeLifecycle: "session-established",
                    data: { sessionToken: "secret-token" },
                });
            }
        );

        const listener = createRpcListener<TestSchema>({
            transport: window,
            allowedOrigins: [MERCHANT_ORIGIN],
            middleware: [middleware],
            lifecycleHandlers: { iframeLifecycle },
        });
        activeListener = listener;

        const source = createSourceStub();
        dispatch(
            MERCHANT_ORIGIN,
            {
                iframeLifecycle: "session-established",
                data: { sessionToken: "secret-token" },
            },
            source
        );
        await vi.waitFor(() => expect(iframeLifecycle).toHaveBeenCalled());

        expect(callOrder).toEqual(["lifecycle"]);
        expect(source.postMessage).toHaveBeenCalledWith({
            iframeLifecycle: "session-established",
            data: { sessionToken: "secret-token" },
        });
    });

    it("runs middleware before the RPC handler", async () => {
        const callOrder: string[] = [];
        const middleware: RpcMiddleware<TestSchema> = {
            onRequest: (_message, context) => {
                callOrder.push("middleware");
                return context;
            },
        };
        const handler = vi.fn(async () => {
            callOrder.push("handler");
            return "pong";
        });

        const listener = createRpcListener<TestSchema>({
            transport: window,
            allowedOrigins: [MERCHANT_ORIGIN],
            middleware: [middleware],
        });
        activeListener = listener;
        listener.handle("frak_ping", handler);

        const source = createSourceStub();
        dispatch(
            MERCHANT_ORIGIN,
            { id: "1", topic: "frak_ping", data: { name: "world" } },
            source
        );
        await vi.waitFor(() => expect(handler).toHaveBeenCalled());

        expect(callOrder).toEqual(["middleware", "handler"]);
    });

    it("produces an error response when middleware throws, instead of silently dropping the request", async () => {
        const middleware: RpcMiddleware<TestSchema> = {
            onRequest: () => {
                throw new Error("middleware rejected the request");
            },
        };
        const handler = vi.fn(async () => "pong");

        const listener = createRpcListener<TestSchema>({
            transport: window,
            allowedOrigins: [MERCHANT_ORIGIN],
            middleware: [middleware],
        });
        activeListener = listener;
        listener.handle("frak_ping", handler);

        const source = createSourceStub();
        dispatch(
            MERCHANT_ORIGIN,
            { id: "1", topic: "frak_ping", data: { name: "world" } },
            source
        );
        await vi.waitFor(() => expect(source.postMessage).toHaveBeenCalled());

        expect(handler).not.toHaveBeenCalled();
        const [message] = source.postMessage.mock.calls[0];
        expect(
            (message as { data: { error: { message: string } } }).data.error
        ).toEqual(
            expect.objectContaining({
                message: "middleware rejected the request",
            })
        );
    });
});

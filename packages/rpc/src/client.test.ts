import type { Mock } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RpcClient, RpcClientConfig } from "./client";
import { createRpcClient } from "./client";
import { FrakRpcError } from "./error";
import type { RpcSchemaEntry } from "./rpc-schema";
import type {
    LifecycleMessage,
    RpcMessage,
    RpcMiddleware,
    RpcResponse,
} from "./types";

type TestSchema = readonly [
    RpcSchemaEntry<"frak_ping", { name: string }, string>,
    RpcSchemaEntry<"frak_watch", undefined, number>,
];

type EmitterStub = {
    postMessage: Mock<(message: RpcMessage, targetOrigin: string) => void>;
};

const WALLET_ORIGIN = "https://wallet.example";
const OTHER_ORIGIN = "https://evil.example";

function respond(origin: string, id: string, response: unknown) {
    window.dispatchEvent(
        new MessageEvent("message", {
            origin,
            data: { id, topic: "frak_ping", data: response },
        })
    );
}

function sendLifecycleFrom(origin: string, message: LifecycleMessage) {
    window.dispatchEvent(
        new MessageEvent("message", { origin, data: message })
    );
}

/** Requests are posted after the onRequest middleware awaits. */
async function sentMessages(emitter: EmitterStub): Promise<RpcMessage[]> {
    await vi.waitFor(() => expect(emitter.postMessage).toHaveBeenCalled());
    return emitter.postMessage.mock.calls.map(([message]) => message);
}

/** Resolves to "pending" unless `promise` settled within a few ticks. */
async function settledOrPending(promise: Promise<unknown>) {
    const pending = new Promise((resolve) =>
        setTimeout(() => resolve("pending"), 20)
    );
    return Promise.race([
        promise.then(
            () => "resolved",
            () => "rejected"
        ),
        pending,
    ]);
}

describe("createRpcClient", () => {
    let client: RpcClient<TestSchema, LifecycleMessage> | undefined;

    function setup(
        overrides: Partial<RpcClientConfig<TestSchema, LifecycleMessage>> = {}
    ) {
        const emitter: EmitterStub = { postMessage: vi.fn() };
        client = createRpcClient<TestSchema, LifecycleMessage>({
            emittingTransport: emitter as unknown as Window,
            listeningTransport: window,
            targetOrigin: `${WALLET_ORIGIN}/listener`,
            ...overrides,
        });
        return { client, emitter };
    }

    afterEach(() => {
        client?.cleanup();
        client = undefined;
        vi.restoreAllMocks();
    });

    it("posts the request to the target origin", async () => {
        const { client, emitter } = setup();

        void client.request({ method: "frak_ping", params: { name: "a" } });
        const [message] = await sentMessages(emitter);

        expect(message).toMatchObject({
            topic: "frak_ping",
            data: { method: "frak_ping", params: { name: "a" } },
        });
        expect(emitter.postMessage).toHaveBeenCalledWith(
            message,
            `${WALLET_ORIGIN}/listener`
        );
    });

    it("resolves a request with the result carrying its id", async () => {
        const { client, emitter } = setup();

        const result = client.request({
            method: "frak_ping",
            params: { name: "a" },
        });
        const [message] = await sentMessages(emitter);
        respond(WALLET_ORIGIN, message.id, { result: "pong" });

        await expect(result).resolves.toBe("pong");
    });

    it("routes each response to its own request", async () => {
        const { client, emitter } = setup();

        const first = client.request({
            method: "frak_ping",
            params: { name: "a" },
        });
        const second = client.request({
            method: "frak_ping",
            params: { name: "b" },
        });
        await vi.waitFor(() =>
            expect(emitter.postMessage).toHaveBeenCalledTimes(2)
        );
        const [a, b] = emitter.postMessage.mock.calls.map(([m]) => m);
        respond(WALLET_ORIGIN, b.id, { result: "second" });
        respond(WALLET_ORIGIN, a.id, { result: "first" });

        await expect(first).resolves.toBe("first");
        await expect(second).resolves.toBe("second");
    });

    it("rejects a request with a FrakRpcError carrying the error code and data", async () => {
        const { client, emitter } = setup();

        const result = client.request({
            method: "frak_ping",
            params: { name: "a" },
        });
        const [message] = await sentMessages(emitter);
        respond(WALLET_ORIGIN, message.id, {
            error: { code: -32007, message: "rejected", data: { why: "user" } },
        });

        const error = await result.catch((e: unknown) => e);
        expect(error).toBeInstanceOf(FrakRpcError);
        expect(error).toMatchObject({
            code: -32007,
            message: "rejected",
            data: { why: "user" },
        });
    });

    it("ignores a response from another origin, even with the right id", async () => {
        const { client, emitter } = setup();

        const result = client.request({
            method: "frak_ping",
            params: { name: "a" },
        });
        const [message] = await sentMessages(emitter);
        respond(OTHER_ORIGIN, message.id, { result: "forged" });

        expect(await settledOrPending(result)).toBe("pending");

        respond(WALLET_ORIGIN, message.id, { result: "real" });
        await expect(result).resolves.toBe("real");
    });

    it("compares origins without case or path", async () => {
        const { client, emitter } = setup({
            targetOrigin: "https://Wallet.Example/listener?x=1",
        });

        const result = client.request({
            method: "frak_ping",
            params: { name: "a" },
        });
        const [message] = await sentMessages(emitter);
        respond(WALLET_ORIGIN, message.id, { result: "pong" });

        await expect(result).resolves.toBe("pong");
    });

    it("ignores a response whose id matches no request", async () => {
        const { client, emitter } = setup();

        const result = client.request({
            method: "frak_ping",
            params: { name: "a" },
        });
        await sentMessages(emitter);
        respond(WALLET_ORIGIN, "unknown-id", { result: "stray" });

        expect(await settledOrPending(result)).toBe("pending");
    });

    it("rejects without posting when an onRequest middleware throws", async () => {
        const failure = new FrakRpcError(-32001, "not connected");
        const { client, emitter } = setup({
            middleware: [
                {
                    onRequest: () => {
                        throw failure;
                    },
                },
            ],
        });

        await expect(
            client.request({ method: "frak_ping", params: { name: "a" } })
        ).rejects.toBe(failure);
        expect(emitter.postMessage).not.toHaveBeenCalled();
    });

    it("runs onRequest middleware in order before posting", async () => {
        const calls: string[] = [];
        const emitter: EmitterStub = {
            postMessage: vi.fn(() => {
                calls.push("post");
            }),
        };
        const record =
            (name: string): RpcMiddleware<TestSchema>["onRequest"] =>
            (_message, context) => {
                calls.push(name);
                return context;
            };
        const middleware: RpcMiddleware<TestSchema>[] = [
            { onRequest: record("first") },
            { onRequest: record("second") },
        ];
        client = createRpcClient<TestSchema, LifecycleMessage>({
            emittingTransport: emitter as unknown as Window,
            listeningTransport: window,
            targetOrigin: WALLET_ORIGIN,
            middleware,
        });

        void client.request({ method: "frak_ping", params: { name: "a" } });
        await sentMessages(emitter);

        expect(calls).toEqual(["first", "second", "post"]);
    });

    it("chains onResponse middleware in order before resolving", async () => {
        const middleware: RpcMiddleware<TestSchema>[] = [
            {
                onResponse: (_m, response) => ({
                    result: `${response.result}+first`,
                }),
            },
            {
                onResponse: (_m, response) => ({
                    result: `${response.result}+second`,
                }),
            },
        ];
        const { client, emitter } = setup({ middleware });

        const result = client.request({
            method: "frak_ping",
            params: { name: "a" },
        });
        const [message] = await sentMessages(emitter);
        respond(WALLET_ORIGIN, message.id, { result: "raw" });

        await expect(result).resolves.toBe("raw+first+second");
    });

    it("hands binary payloads to onResponse wrapped as a result", async () => {
        const seen: RpcResponse[] = [];
        const { client, emitter } = setup({
            middleware: [
                {
                    onResponse: (_m, response) => {
                        seen.push(response);
                        return { result: "decoded" };
                    },
                },
            ],
        });

        const result = client.request({
            method: "frak_ping",
            params: { name: "a" },
        });
        const [message] = await sentMessages(emitter);
        const payload = new Uint8Array([1, 2, 3]);
        respond(WALLET_ORIGIN, message.id, payload);

        await expect(result).resolves.toBe("decoded");
        expect(seen).toEqual([{ result: payload }]);
    });

    it("delivers every stream result until unsubscribed", async () => {
        const { client, emitter } = setup();
        const received: number[] = [];

        const unsubscribe = client.listen({ method: "frak_watch" }, (value) => {
            received.push(value);
        });
        const [message] = await sentMessages(emitter);
        respond(WALLET_ORIGIN, message.id, { result: 1 });
        respond(WALLET_ORIGIN, message.id, { result: 2 });
        await vi.waitFor(() => expect(received).toEqual([1, 2]));

        unsubscribe();
        respond(WALLET_ORIGIN, message.id, { result: 3 });
        await settledOrPending(new Promise(() => {}));

        expect(received).toEqual([1, 2]);
    });

    it("closes a stream after an error response", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { client, emitter } = setup();
        const received: number[] = [];

        client.listen({ method: "frak_watch" }, (value) => {
            received.push(value);
        });
        const [message] = await sentMessages(emitter);
        respond(WALLET_ORIGIN, message.id, {
            error: { code: -32603, message: "boom" },
        });
        respond(WALLET_ORIGIN, message.id, { result: 1 });
        await settledOrPending(new Promise(() => {}));

        expect(received).toEqual([]);
    });

    it("routes lifecycle messages to their handler and never to a channel", async () => {
        const iframeLifecycle = vi.fn();
        const { client, emitter } = setup({
            lifecycleHandlers: { iframeLifecycle },
        });
        const result = client.request({
            method: "frak_ping",
            params: { name: "a" },
        });
        await sentMessages(emitter);

        sendLifecycleFrom(WALLET_ORIGIN, { iframeLifecycle: "connected" });
        await vi.waitFor(() => expect(iframeLifecycle).toHaveBeenCalled());

        expect(iframeLifecycle).toHaveBeenCalledWith(
            { iframeLifecycle: "connected" },
            { origin: `${WALLET_ORIGIN}/listener`, source: null }
        );
        expect(await settledOrPending(result)).toBe("pending");
    });

    it("routes a clientLifecycle message to its own handler", async () => {
        const clientLifecycle = vi.fn();
        const iframeLifecycle = vi.fn();
        setup({ lifecycleHandlers: { clientLifecycle, iframeLifecycle } });

        sendLifecycleFrom(WALLET_ORIGIN, { clientLifecycle: "heartbeat" });
        await vi.waitFor(() => expect(clientLifecycle).toHaveBeenCalled());

        expect(clientLifecycle).toHaveBeenCalledWith(
            { clientLifecycle: "heartbeat" },
            { origin: `${WALLET_ORIGIN}/listener`, source: null }
        );
        expect(iframeLifecycle).not.toHaveBeenCalled();
    });

    it("ignores a lifecycle message from another origin", async () => {
        const iframeLifecycle = vi.fn();
        setup({ lifecycleHandlers: { iframeLifecycle } });

        sendLifecycleFrom(OTHER_ORIGIN, { iframeLifecycle: "connected" });
        await settledOrPending(new Promise(() => {}));

        expect(iframeLifecycle).not.toHaveBeenCalled();
    });

    it("sends lifecycle messages straight to the target origin, skipping middleware", () => {
        const onRequest = vi.fn((_m, ctx) => ctx);
        const { client, emitter } = setup({ middleware: [{ onRequest }] });

        client.sendLifecycle({ clientLifecycle: "heartbeat" });

        expect(emitter.postMessage).toHaveBeenCalledWith(
            { clientLifecycle: "heartbeat" },
            `${WALLET_ORIGIN}/listener`
        );
        expect(onRequest).not.toHaveBeenCalled();
    });

    it("stops delivering responses and lifecycle messages after cleanup", async () => {
        const iframeLifecycle = vi.fn();
        const { client, emitter } = setup({
            lifecycleHandlers: { iframeLifecycle },
        });
        const received: number[] = [];

        client.listen({ method: "frak_watch" }, (value) => {
            received.push(value);
        });
        const [message] = await sentMessages(emitter);
        client.cleanup();
        respond(WALLET_ORIGIN, message.id, { result: 1 });
        sendLifecycleFrom(WALLET_ORIGIN, { iframeLifecycle: "connected" });
        await settledOrPending(new Promise(() => {}));

        expect(received).toEqual([]);
        expect(iframeLifecycle).not.toHaveBeenCalled();
    });
});

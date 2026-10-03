import { IS_IOS } from "@frak-labs/app-essentials/utils/platform";
import { recordError } from "@frak-labs/wallet-shared";
import { addPluginListener, invoke } from "@tauri-apps/api/core";

const PLUGIN = "frak-glass";

let supported = false;

/** Probed before first render, so a screen never mounts the wrong twin and swaps it. */
export async function initNativeGlass() {
    if (!IS_IOS) return;
    try {
        const result = await invoke<{ supported: boolean }>(
            `plugin:${PLUGIN}|is_supported`
        );
        supported = result.supported;
    } catch (error) {
        recordError(error, { source: "native_glass" });
    }
}

/** Whether native Liquid Glass chrome replaces its web twin on this device. */
export function hasNativeGlass(): boolean {
    return IS_IOS && supported;
}

/**
 * Mirrors one native surface's state: patches merge, and the whole state is
 * sent once per microtask, so an unmount/mount pair in one commit reaches
 * native as its net result.
 */
export function createNativeSync<
    State extends Record<string, unknown>,
    Result = unknown,
>(command: string, initial: State, onResult?: (result: Result) => void) {
    let desired = initial;
    let queued = false;

    async function flush() {
        queued = false;
        try {
            const result = await invoke<Result>(
                `plugin:${PLUGIN}|${command}`,
                desired
            );
            onResult?.(result);
        } catch (error) {
            recordError(error, { source: "native_glass" });
        }
    }

    return (patch: Partial<State>) => {
        desired = { ...desired, ...patch };
        if (queued) return;
        queued = true;
        queueMicrotask(flush);
    };
}

type Handler = (payload: unknown) => void;

const handlers = new Map<string, Set<Handler>>();
const registered = new Set<string>();

/**
 * Subscribes to a plugin event; returns the unsubscribe. Each event is
 * registered natively once and never removed: Tauri edits its listener table
 * on the IPC queue while native taps read it on the main thread.
 */
export function onNativeEvent<Payload>(
    event: string,
    handler: (payload: Payload) => void
): () => void {
    let subscribers = handlers.get(event);
    if (!subscribers) {
        subscribers = new Set();
        handlers.set(event, subscribers);
    }
    const entry: Handler = (payload) => handler(payload as Payload);
    subscribers.add(entry);
    register(event, subscribers);
    return () => {
        subscribers.delete(entry);
    };
}

function register(event: string, subscribers: Set<Handler>) {
    if (registered.has(event)) return;
    registered.add(event);
    addPluginListener<unknown>(PLUGIN, event, (payload) => {
        for (const entry of [...subscribers]) entry(payload);
    }).catch((error) => {
        // The next subscriber retries.
        registered.delete(event);
        recordError(error, { source: "native_glass" });
    });
}

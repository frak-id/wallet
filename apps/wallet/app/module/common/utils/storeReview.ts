import { getInvoke } from "@frak-labs/wallet-shared";

/** Resolves whether the native layer asked the store to show its rating prompt. */
export async function requestStoreReview(): Promise<boolean> {
    try {
        const invoke = await getInvoke();
        const { requested } = await invoke<{ requested: boolean }>(
            "plugin:store-review|request_review"
        );
        return requested;
    } catch {
        // An OTA bundle can run on a binary that predates the plugin: the command is then missing.
        return false;
    }
}

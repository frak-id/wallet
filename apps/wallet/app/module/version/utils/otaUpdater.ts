import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";

/**
 * `{stage}-{platform}-{version}` for a mobile build, `null` everywhere else.
 * Substituted by `vite.defines.ts`; see the comment there for why all three
 * axes have to be in the channel.
 */
declare const __OTA_CHANNEL__: string | null;

/**
 * Outcome of a single OTA pass.
 *
 * `staged` means the new web assets were verified, written to the app cache
 * and swapped into the running asset resolver. The webview keeps serving the
 * bundle it already parsed, so the change only becomes visible after a reload
 * or the next cold start.
 */
export type OtaUpdateResult =
    | { status: "unsupported" }
    | { status: "up_to_date" }
    | { status: "staged" };

/**
 * Stage a CrabNebula OTA update for the web assets.
 *
 * Dynamically imported so the browser build never pulls the Tauri runtime in.
 * The Rust plugin already runs its own check during app setup; that pass drops
 * its result, so this call is what actually persists an update.
 */
export async function stageOtaUpdate(): Promise<OtaUpdateResult> {
    if (!IS_TAURI) return { status: "unsupported" };

    const channel = __OTA_CHANNEL__;
    if (!channel) return { status: "unsupported" };

    const { check, setChannel } = await import(
        "@crabnebula/plugin-ota-updater"
    );
    await setChannel(channel);
    const update = await check();
    if (!update) return { status: "up_to_date" };

    await update.apply();
    return { status: "staged" };
}

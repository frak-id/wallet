import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";

/**
 * `{stage}-{platform}-{version}` for a mobile build, `null` everywhere else.
 * Substituted by `vite.defines.ts`; see the comment there for why all three
 * axes have to be in the channel.
 */
declare const __OTA_CHANNEL__: string | null;

/**
 * `staged`: verified and cached. Later asset requests already get the new
 * bundle; code loaded before stays until the next launch.
 */
export type OtaUpdateResult =
    | { status: "unsupported" }
    | { status: "up_to_date" }
    | { status: "staged" };

/**
 * The only OTA check: the plugin's boot check is off (`updateOnStartup: false`).
 * The plugin is imported dynamically so the browser build never pulls it in.
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

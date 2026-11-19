import { IS_ANDROID } from "@frak-labs/app-essentials/utils/platform";
import { getInvoke, openExternalUrl } from "@frak-labs/wallet-shared";
import { FRAK_INSTAGRAM_DM_URL } from "@/module/instagram/config";

const INSTAGRAM_ANDROID_PACKAGE = "com.instagram.android";

/** Android routes `ig.me` through the browser, whose redirect Instagram opens on its home feed; the app itself opens the thread. */
export async function openInstagramDm(code: string): Promise<void> {
    const url = `${FRAK_INSTAGRAM_DM_URL}?ref=${code}`;
    if (IS_ANDROID) {
        try {
            const invoke = await getInvoke();
            await invoke("plugin:frak-share|open_in_app", {
                url,
                packageName: INSTAGRAM_ANDROID_PACKAGE,
            });
            return;
        } catch {
            // Instagram not installed, or a native build without the command (OTA): use the browser.
        }
    }
    await openExternalUrl(url);
}

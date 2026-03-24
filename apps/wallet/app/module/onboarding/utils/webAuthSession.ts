import { isIOS, isTauri } from "@frak-labs/app-essentials/utils/platform";

type WebAuthSessionResult = {
    callbackUrl: string;
};

export async function startWebAuthSession(
    url: string,
    callbackScheme: string
): Promise<WebAuthSessionResult> {
    if (!isTauri() || !isIOS()) {
        throw new Error("Web auth session is only available on iOS");
    }

    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<WebAuthSessionResult>(
        "plugin:web-auth-session|start_web_auth_session",
        { url, callbackScheme }
    );
}

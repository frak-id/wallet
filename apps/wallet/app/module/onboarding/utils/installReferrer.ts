import { isAndroid, isTauri } from "@frak-labs/app-essentials/utils/platform";
import { getInvoke } from "@frak-labs/wallet-shared";

type InstallReferrerResult = {
    referrer: string;
    clickTimestamp: number;
    installTimestamp: number;
};

export async function getInstallReferrer(): Promise<InstallReferrerResult> {
    if (!isTauri() || !isAndroid()) {
        throw new Error("Install referrer is only available on Android");
    }

    const invoke = await getInvoke();
    return invoke<InstallReferrerResult>(
        "plugin:install-referrer|get_install_referrer"
    );
}

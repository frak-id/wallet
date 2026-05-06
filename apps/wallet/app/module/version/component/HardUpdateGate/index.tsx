import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FullScreenGate } from "@/module/common/component/FullScreenGate";
import { openNativeStore } from "../../utils/nativeUpdater";

type HardUpdateGateProps = {
    currentVersion: string;
    minVersion: string;
};

/**
 * Blocking gate shown when the installed bundle is below the backend
 * `minVersion` floor. Tapping the CTA defers to the platform store via
 * `openNativeStore`; if that fails (no Play Services, store unavailable,
 * URL scheme rejected) we surface a fallback message so the user knows
 * the deep-link didn't take rather than leaving them on a button that
 * appears to do nothing.
 */
export function HardUpdateGate({
    currentVersion,
    minVersion,
}: HardUpdateGateProps) {
    const { t } = useTranslation();
    const openStore = useMutation({
        mutationKey: ["version", "open-store"],
        mutationFn: openNativeStore,
    });

    // `opened === false` covers both the resolved-but-rejected case (system
    // refused the URL) and any thrown error after a retry.
    const showFallback =
        openStore.isError ||
        (openStore.isSuccess && openStore.data === false);

    return (
        <FullScreenGate
            title={t("version.hardUpdate.title")}
            description={
                <>
                    <Text variant="bodySmall">
                        {t("version.hardUpdate.description", {
                            currentVersion,
                            minVersion,
                        })}
                    </Text>
                    {showFallback && (
                        <Text variant="bodySmall">
                            {t("version.hardUpdate.fallback")}
                        </Text>
                    )}
                </>
            }
            action={
                <Button
                    onClick={() => openStore.mutate()}
                    disabled={openStore.isPending}
                >
                    {t(
                        showFallback
                            ? "version.hardUpdate.retry"
                            : "version.hardUpdate.cta"
                    )}
                </Button>
            }
        />
    );
}
